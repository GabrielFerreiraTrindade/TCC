import type { StudyQuestClient } from "./supabaseClient";
import { mapProfile, mapQuestion, mapQuizSession, mapTrack } from "./mappers";
import type {
  AnswerSubmission,
  Difficulty,
  GradedAnswer,
  Locale,
  PracticeQuestionsResult,
  Profile,
  QuizMode,
  QuizSession,
  Question,
  ReportReason,
  Track,
} from "./types";

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

/**
 * Perguntas do diagnóstico inicial, misturando os 3 níveis. Embaralho de alternativas e
 * ordem das perguntas acontece no servidor (RPC get_diagnostic_questions, migration 0003).
 */
export async function getDiagnosticQuestions(
  client: StudyQuestClient,
  trackId: string,
  locale: Locale = "pt",
  countPerLevel = 3,
): Promise<Question[]> {
  const { data, error } = await client
    .rpc("get_diagnostic_questions", { p_track_id: trackId, p_locale: locale, p_count_per_level: countPerLevel })
    .single();
  if (error) throw error;
  return data.questions.map(mapQuestion);
}

/**
 * Perguntas de uma sessão de prática: prioriza inéditas para o aluno, depois as que ele
 * errou (RPC get_practice_questions, migration 0003). `lowInventory` indica que restam
 * poucas perguntas inéditas — é o sinal para disparar geração de um novo lote por IA.
 */
export async function getPracticeQuestions(
  client: StudyQuestClient,
  trackId: string,
  difficulty: Difficulty,
  locale: Locale = "pt",
  count = 8,
): Promise<PracticeQuestionsResult> {
  const { data, error } = await client
    .rpc("get_practice_questions", {
      p_track_id: trackId,
      p_difficulty: difficulty,
      p_locale: locale,
      p_count: count,
    })
    .single();
  if (error) throw error;
  return { questions: data.questions.map(mapQuestion), lowInventory: data.low_inventory };
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
 * Corrige a resposta no servidor via RPC `submit_quiz_answer` (migration 0002/0003): o
 * cliente nunca teve o gabarito antes de responder, só recebe correctOptionId/
 * optionExplanations (uma explicação por alternativa) depois.
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
    optionExplanations: data.option_explanations ?? {},
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

/** O aluno sinaliza um problema numa pergunta; após 3 reports distintos ela sai de circulação. */
export async function reportQuestion(
  client: StudyQuestClient,
  questionId: string,
  reason: ReportReason,
  detail?: string,
): Promise<void> {
  const { error } = await client.rpc("report_question", {
    p_question_id: questionId,
    p_reason: reason,
    p_detail: detail,
  });
  if (error) throw error;
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
