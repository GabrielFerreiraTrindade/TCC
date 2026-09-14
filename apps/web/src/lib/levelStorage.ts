import type { Difficulty } from "@studyquest/shared";

/**
 * O nível "atual" de cada usuário por trilha fica salvo no localStorage do
 * navegador (não no banco) para manter o schema enxuto neste MVP. Ver
 * README para a discussão dessa simplificação e como evoluir para
 * persistência no servidor.
 */
function storageKey(userId: string, trackId: string): string {
  return `studyquest:level:${userId}:${trackId}`;
}

export function getStoredLevel(userId: string, trackId: string): Difficulty | null {
  if (typeof window === "undefined") return null;
  return (window.localStorage.getItem(storageKey(userId, trackId)) as Difficulty | null) ?? null;
}

export function setStoredLevel(userId: string, trackId: string, level: Difficulty): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId, trackId), level);
}
