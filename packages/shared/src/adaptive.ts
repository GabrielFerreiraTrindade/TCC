import { DIFFICULTIES, type Difficulty } from "./types";

export interface DiagnosticAccuracy {
  iniciante: number;
  intermediario: number;
  avancado: number;
}

/**
 * Diagnóstico inicial: a pessoa responde perguntas breves de todos os níveis
 * antes de ter uma conta "classificada". O nível recomendado é o mais alto
 * cuja acurácia bateu o limiar exigido, assumindo que quem manda bem no
 * avançado também mandaria bem em níveis mais fáceis.
 */
export function suggestStartingLevel(accuracy: DiagnosticAccuracy): Difficulty {
  if (accuracy.avancado >= 0.7) return "avancado";
  if (accuracy.intermediario >= 0.6) return "intermediario";
  return "iniciante";
}

const LEVEL_UP_THRESHOLD = 0.8;
const LEVEL_DOWN_THRESHOLD = 0.4;

/**
 * Ajuste adaptativo após uma sessão de prática: sobe de nível quando o
 * desempenho é consistentemente alto, desce quando está consistentemente
 * baixo, e mantém o nível atual no meio-termo.
 */
export function suggestNextLevel(currentLevel: Difficulty, sessionAccuracy: number): Difficulty {
  const currentIndex = DIFFICULTIES.indexOf(currentLevel);

  if (sessionAccuracy >= LEVEL_UP_THRESHOLD && currentIndex < DIFFICULTIES.length - 1) {
    return DIFFICULTIES[currentIndex + 1];
  }

  if (sessionAccuracy < LEVEL_DOWN_THRESHOLD && currentIndex > 0) {
    return DIFFICULTIES[currentIndex - 1];
  }

  return currentLevel;
}
