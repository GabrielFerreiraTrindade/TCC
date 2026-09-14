export type Difficulty = "iniciante" | "intermediario" | "avancado";

export const DIFFICULTIES: Difficulty[] = ["iniciante", "intermediario", "avancado"];

export type QuizMode = "diagnostic" | "practice";

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

export interface Question {
  id: string;
  trackId: string;
  categoryId: string | null;
  difficulty: Difficulty;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string | null;
  timeLimitSeconds: number;
}

/** Question shape safe to send to the client before it is answered (no answer key). */
export type PublicQuestion = Omit<Question, "correctOptionId" | "explanation">;

export function toPublicQuestion(question: Question): PublicQuestion {
  const { correctOptionId: _correctOptionId, explanation: _explanation, ...publicFields } = question;
  return publicFields;
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
  explanation: string | null;
}
