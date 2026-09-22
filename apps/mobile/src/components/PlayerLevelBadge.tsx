import { StyleSheet, Text, View } from "react-native";
import { getPlayerLevel } from "@studyquest/shared";

export function PlayerLevelBadge({ totalPoints }: { totalPoints: number }) {
  const { level, pointsIntoLevel, pointsForNextLevel, progress } = getPlayerLevel(totalPoints);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Nível {level}</Text>
        <Text style={styles.label}>
          {pointsIntoLevel} / {pointsForNextLevel} pts
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569" },
  track: { height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: "#4f46e5" },
});
