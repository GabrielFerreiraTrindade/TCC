/**
 * Nível de jogador (XP): gamificação separada do nivelamento iniciante/intermediário/avançado
 * (que continua controlando só a dificuldade das perguntas, em adaptive.ts). Este nível sobe
 * conforme o total de pontos acumulados no perfil (profiles.total_points), em qualquer trilha.
 *
 * Curva triangular: o nível N começa em 50*(N-1)*N pontos. Cada nível seguinte exige 100 pontos
 * a mais de progresso que o anterior (100, 200, 300, ...), ficando gradualmente mais difícil de
 * subir — comum em curvas de XP de jogos e simples de justificar no TCC.
 */
export interface PlayerLevelInfo {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  progress: number;
}

function thresholdForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export function getPlayerLevel(totalPoints: number): PlayerLevelInfo {
  const points = Math.max(0, totalPoints);

  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * points) / 50)) / 2));
  while (thresholdForLevel(level + 1) <= points) level += 1;
  while (level > 1 && thresholdForLevel(level) > points) level -= 1;

  const currentThreshold = thresholdForLevel(level);
  const nextThreshold = thresholdForLevel(level + 1);
  const pointsForNextLevel = nextThreshold - currentThreshold;

  return {
    level,
    pointsIntoLevel: points - currentThreshold,
    pointsForNextLevel,
    progress: (points - currentThreshold) / pointsForNextLevel,
  };
}
