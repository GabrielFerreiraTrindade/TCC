import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { PlayerLevelBadge } from "../components/PlayerLevelBadge";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getProfile, getTrackLevel, getTracks, type Difficulty, type Profile, type Track } from "@studyquest/shared";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const LEVEL_LABEL: Record<Difficulty, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

interface TrackWithLevel {
  track: Track;
  level: Difficulty | null;
}

export default function HomeScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tracks, setTracks] = useState<TrackWithLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [profileResult, tracksResult] = await Promise.all([getProfile(supabase, session.user.id), getTracks(supabase)]);
    setProfile(profileResult);
    const withLevels = await Promise.all(
      tracksResult.map(async (track) => ({
        track,
        level: await getTrackLevel(supabase, session.user.id, track.id),
      })),
    );
    setTracks(withLevels);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <View style={styles.card}>
        <Text style={styles.greeting}>Olá, {profile?.username}</Text>
        <Text style={styles.points}>{profile?.totalPoints ?? 0} pontos</Text>
        {profile ? <PlayerLevelBadge totalPoints={profile.totalPoints} /> : null}
      </View>

      {tracks.map(({ track, level }) => (
        <View key={track.id} style={styles.card}>
          <Text style={styles.trackName}>{track.name}</Text>
          <Text style={styles.trackDescription}>{track.description}</Text>

          {level ? (
            <>
              <Text style={styles.levelLabel}>Seu nível atual: {LEVEL_LABEL[level]}</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => navigation.navigate("Quiz", { trackSlug: track.slug, mode: "practice", difficulty: level })}
              >
                <Text style={styles.primaryButtonText}>Praticar ({LEVEL_LABEL[level]})</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.levelLabel}>Faça o diagnóstico inicial para descobrirmos seu nível.</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => navigation.navigate("Quiz", { trackSlug: track.slug, mode: "diagnostic", difficulty: null })}
              >
                <Text style={styles.primaryButtonText}>Iniciar diagnóstico</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Profile")}>
        <Text style={styles.secondaryButtonText}>Perfil e ranking</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={signOut}>
        <Text style={styles.secondaryButtonText}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, backgroundColor: "#f8fafc", flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, gap: 8 },
  greeting: { fontSize: 18, fontWeight: "600", color: "#0f172a" },
  points: { fontSize: 28, fontWeight: "800", color: "#059669" },
  trackName: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  trackDescription: { color: "#475569" },
  levelLabel: { marginTop: 8, color: "#1e293b", fontWeight: "600" },
  primaryButton: { backgroundColor: "#4f46e5", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { paddingVertical: 12, alignItems: "center" },
  secondaryButtonText: { color: "#334155", fontWeight: "600" },
});
