import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getLeaderboard, getProfile, type Profile } from "@studyquest/shared";

export default function ProfileScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!session) return;
      const [profileResult, leaderboardResult] = await Promise.all([
        getProfile(supabase, session.user.id),
        getLeaderboard(supabase, 20),
      ]);
      setProfile(profileResult);
      setLeaderboard(leaderboardResult);
      setLoading(false);
    }
    load();
  }, [session]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.username}>{profile?.username}</Text>
        <Text style={styles.points}>{profile?.totalPoints ?? 0} pontos</Text>
      </View>

      <Text style={styles.sectionTitle}>Ranking</Text>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.id === profile?.id && styles.rowHighlight]}>
            <Text style={styles.rowPosition}>{index + 1}</Text>
            <Text style={styles.rowUsername}>{item.username}</Text>
            <Text style={styles.rowPoints}>{item.totalPoints}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8fafc", gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: "center", gap: 4 },
  username: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  points: { fontSize: 28, fontWeight: "800", color: "#059669" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  rowHighlight: { borderWidth: 2, borderColor: "#4f46e5" },
  rowPosition: { width: 24, fontWeight: "700", color: "#64748b" },
  rowUsername: { flex: 1, fontWeight: "600", color: "#0f172a" },
  rowPoints: { fontWeight: "700", color: "#059669" },
});
