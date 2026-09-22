import type { Database } from "./database.types";
import type {
  Category,
  Difficulty,
  Profile,
  QuizAnswer,
  QuizMode,
  QuizSession,
  Question,
  Track,
} from "./types";

type TrackRow = Database["public"]["Tables"]["tracks"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type QuizSessionRow = Database["public"]["Tables"]["quiz_sessions"]["Row"];
type QuizAnswerRow = Database["public"]["Tables"]["quiz_answers"]["Row"];

/**
 * Só as colunas que anon/authenticated ainda conseguem ler de `questions` (ver migration
 * 0002 — correct_option_id/explanation foram revogadas). Deliberadamente um tipo à parte
 * do `Database["public"]["Tables"]["questions"]["Row"]` completo, que ainda declara essas
 * colunas (reflete o schema da tabela, não os grants de coluna por role).
 */
interface PublicQuestionRow {
  id: string;
  track_id: string;
  category_id: string | null;
  difficulty: string;
  prompt: string;
  options: { id: string; text: string }[];
  time_limit_seconds: number;
}

export function mapTrack(row: TrackRow): Track {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description };
}

export function mapCategory(row: CategoryRow): Category {
  return { id: row.id, trackId: row.track_id, name: row.name };
}

export function mapQuestion(row: PublicQuestionRow): Question {
  return {
    id: row.id,
    trackId: row.track_id,
    categoryId: row.category_id,
    difficulty: row.difficulty as Difficulty,
    prompt: row.prompt,
    options: row.options,
    timeLimitSeconds: row.time_limit_seconds,
  };
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    totalPoints: row.total_points,
    createdAt: row.created_at,
  };
}

export function mapQuizSession(row: QuizSessionRow): QuizSession {
  return {
    id: row.id,
    userId: row.user_id,
    trackId: row.track_id,
    mode: row.mode as QuizMode,
    difficulty: row.difficulty as Difficulty | null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    totalPoints: row.total_points,
    questionsCount: row.questions_count,
    correctCount: row.correct_count,
  };
}

export function mapQuizAnswer(row: QuizAnswerRow): QuizAnswer {
  return {
    id: row.id,
    sessionId: row.session_id,
    questionId: row.question_id,
    selectedOptionId: row.selected_option_id,
    isCorrect: row.is_correct,
    timeTakenMs: row.time_taken_ms,
    pointsAwarded: row.points_awarded,
    answeredAt: row.answered_at,
  };
}
