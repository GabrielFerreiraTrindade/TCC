import type { Difficulty } from "./types";

/** Pontos base concedidos por acerto, de acordo com a dificuldade da pergunta. */
export const BASE_POINTS: Record<Difficulty, number> = {
  iniciante: 10,
  intermediario: 20,
  avancado: 35,
};

const MAX_SPEED_MULTIPLIER = 2.0;
const MIN_SPEED_MULTIPLIER = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Quanto mais rápido dentro do tempo limite, maior o multiplicador (até 2x).
 * Responder no limite do tempo ainda garante o multiplicador mínimo (0.5x),
 * então uma resposta correta nunca vale zero por demorar.
 */
export function speedMultiplier(timeTakenMs: number, timeLimitSeconds: number): number {
  const timeLimitMs = timeLimitSeconds * 1000;
  const usedFraction = clamp(timeTakenMs / timeLimitMs, 0, 1);
  return MAX_SPEED_MULTIPLIER - (MAX_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER) * usedFraction;
}

export interface ScoreInput {
  difficulty: Difficulty;
  isCorrect: boolean;
  timeTakenMs: number;
  timeLimitSeconds: number;
}

/** Calcula os pontos de uma resposta: 0 se errada, ou pontos base * multiplicador de velocidade. */
export function calculatePoints({ difficulty, isCorrect, timeTakenMs, timeLimitSeconds }: ScoreInput): number {
  if (!isCorrect) return 0;
  const multiplier = speedMultiplier(timeTakenMs, timeLimitSeconds);
  return Math.round(BASE_POINTS[difficulty] * multiplier);
}
