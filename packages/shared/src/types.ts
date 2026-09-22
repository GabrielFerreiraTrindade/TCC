export type Difficulty = "iniciante" | "intermediario" | "avancado";

export const DIFFICULTIES: Difficulty[] = ["iniciante", "intermediario", "avancado"];

export type QuizMode = "diagnostic" | "practice";

export type Locale = "pt" | "en";

export interface Track {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface Category {
  id: string;
  trackId: string;
  name: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

/**
 * Formato que o cliente enxerga antes de responder: sem gabarito. Vem só de
 * get_practice_questions/get_diagnostic_questions (RPCs SECURITY DEFINER — anon/authenticated
 * não têm mais SELECT direto em `questions` desde a migration 0003). A correção acontece via
 * RPC `submit_quiz_answer`, que devolve o gabarito e as explicações só depois da resposta
 * (GradedAnswer, abaixo).
 */
export interface Question {
  id: string;
  difficulty: Difficulty;
  prompt: string;
  options: QuestionOption[];
  timeLimitSeconds: number;
}

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  createdAt: string;
}

export interface QuizSession {
  id: string;
  userId: string;
  trackId: string;
  mode: QuizMode;
  difficulty: Difficulty | null;
  startedAt: string;
  finishedAt: string | null;
  totalPoints: number;
  questionsCount: number;
  correctCount: number;
}

export interface QuizAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timeTakenMs: number;
  pointsAwarded: number;
  answeredAt: string;
}

export interface AnswerSubmission {
  questionId: string;
  selectedOptionId: string;
  timeTakenMs: number;
}

export interface GradedAnswer extends AnswerSubmission {
  isCorrect: boolean;
  pointsAwarded: number;
  correctOptionId: string;
  /** Uma explicação por alternativa (id -> texto), certa e erradas. */
  optionExplanations: Record<string, string>;
}

export interface PracticeQuestionsResult {
  questions: Question[];
  /** Poucas perguntas inéditas restando para esse tema/nível/idioma — hora de gerar mais. */
  lowInventory: boolean;
}

export type ReportReason = "gabarito_errado" | "traducao_ruim" | "confusa" | "duplicada" | "outro";
