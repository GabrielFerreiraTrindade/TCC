import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Difficulty } from "@studyquest/shared";

/**
 * O nível "atual" de cada usuário por trilha fica salvo localmente (não no
 * banco) para manter o schema enxuto neste MVP. Ver README para a
 * discussão dessa simplificação e como evoluir para persistência no servidor.
 */
function storageKey(userId: string, trackId: string): string {
  return `studyquest:level:${userId}:${trackId}`;
}

export async function getStoredLevel(userId: string, trackId: string): Promise<Difficulty | null> {
  const value = await AsyncStorage.getItem(storageKey(userId, trackId));
  return (value as Difficulty | null) ?? null;
}

export async function setStoredLevel(userId: string, trackId: string, level: Difficulty): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId, trackId), level);
}
