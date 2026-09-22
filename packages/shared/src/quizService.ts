import type { StudyQuestClient } from "./supabaseClient";
import { mapProfile, mapQuestion, mapQuizSession, mapTrack } from "./mappers";
import type {
  AnswerSubmission,
  Difficulty,
  GradedAnswer,
  Profile,
  QuizMode,
  QuizSession,
  Question,
  Track,
} from "./types";

/** Colunas de `questions` que anon/authenticated ainda podem ler (ver migration 0002). */
const PUBLIC_QUESTION_COLUMNS = "id, track_id, category_id, difficulty, prompt, options, time_limit_seconds";

export async function getTracks(client: StudyQuestClient): Promise<Track[]> {
  const { data, error } = await client.from("tracks").select("*").order("name");
  if (error) throw error;
  return data.map(mapTrack);
}

export async function getTrackBySlug(client: StudyQuestClient, slug: string): Promise<Track> {
  const { data, error } = await client.from("tracks").select("*").eq("slug", slug).single();
  if (error) throw error;
  return mapTrack(data);
}

/** Sorteia `countPerLevel` perguntas de cada nível para o diagnóstico inicial. */
export async function getDiagnosticQuestions(
  client: StudyQuestClient,
  trackId: string,
  countPerLevel = 3,
): Promise<Question[]> {
  const levels: Difficulty[] = ["iniciante", "intermediario", "avancado"];
  const batches = await Promise.all(
    levels.map((difficulty) =>
      client
        .from("questions")
        .select(PUBLIC_QUESTION_COLUMNS)
        .eq("track_id", trackId)
        .eq("difficulty", difficulty)
        .limit(countPerLevel * 3),
    ),
  );

  return batches.flatMap((batch, index) => {
    if (batch.error) throw batch.error;
    return shuffle(batch.data).slice(0, countPerLevel).map(mapQuestion).map((q) => ({ ...q, difficulty: levels[index] }));
  });
}

export async function getPracticeQuestions(
  client: StudyQuestClient,
  trackId: string,
  difficulty: Difficulty,
  count = 10,
): Promise<Question[]> {
  const { data, error } = await client
    .from("questions")
    .select(PUBLIC_QUESTION_COLUMNS)
    .eq("track_id", trackId)
    .eq("difficulty", difficulty)
    .limit(count * 3);
  if (error) throw error;
  return shuffle(data).slice(0, count).map(mapQuestion);
}

export async function startSession(
  client: StudyQuestClient,
  args: { userId: string; trackId: string; mode: QuizMode; difficulty: Difficulty | null },
): Promise<QuizSession> {
  const { data, error } = await client
    .from("quiz_sessions")
    .insert({ user_id: args.userId, track_id: args.trackId, mode: args.mode, difficulty: args.difficulty })
    .select("*")
    .single();
  if (error) throw error;
  return mapQuizSession(data);
}

/**
 * Corrige a resposta no servidor via RPC `submit_quiz_answer` (migration 0002): o cliente
 * nunca teve o gabarito antes de responder, só recebe correctOptionId/explanation depois.
 */
export async function submitAnswer(
  client: StudyQuestClient,
  session: QuizSession,
  question: Question,
  submission: AnswerSubmission,
): Promise<GradedAnswer> {
  const { data, error } = await client
    .rpc("submit_quiz_answer", {
      p_session_id: session.id,
      p_question_id: question.id,
      p_selected_option_id: submission.selectedOptionId,
      p_time_taken_ms: submission.timeTakenMs,
    })
    .single();
  if (error) throw error;

  return {
    ...submission,
    isCorrect: data.is_correct,
    pointsAwarded: data.points_awarded,
    correctOptionId: data.correct_option_id,
    explanation: data.explanation,
  };
}

export async function finishSession(
  client: StudyQuestClient,
  sessionId: string,
  totals: { totalPoints: number; questionsCount: number; correctCount: number },
): Promise<QuizSession> {
  const { data, error } = await client
    .from("quiz_sessions")
    .update({
      finished_at: new Date().toISOString(),
      total_points: totals.totalPoints,
      questions_count: totals.questionsCount,
      correct_count: totals.correctCount,
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) throw error;
  return mapQuizSession(data);
}

export async function getProfile(client: StudyQuestClient, userId: string): Promise<Profile> {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return mapProfile(data);
}

export async function getLeaderboard(client: StudyQuestClient, limit = 20): Promise<Profile[]> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .order("total_points", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(mapProfile);
}

/** Nível atual do usuário numa trilha, persistido no banco (sincroniza entre dispositivos). */
export async function getTrackLevel(
  client: StudyQuestClient,
  userId: string,
  trackId: string,
): Promise<Difficulty | null> {
  const { data, error } = await client
    .from("user_track_levels")
    .select("level")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .maybeSingle();
  if (error) throw error;
  return (data?.level as Difficulty | undefined) ?? null;
}

export async function setTrackLevel(
  client: StudyQuestClient,
  userId: string,
  trackId: string,
  level: Difficulty,
): Promise<void> {
  const { error } = await client
    .from("user_track_levels")
    .upsert(
      { user_id: userId, track_id: trackId, level, updated_at: new Date().toISOString() },
      { onConflict: "user_id,track_id" },
    );
  if (error) throw error;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
