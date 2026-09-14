import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Difficulty } from "@studyquest/shared";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

const LEVEL_LABEL: Record<Difficulty, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export default function ResultsScreen({ route, navigation }: Props) {
  const { mode, totalPoints, correctCount, questionsCount, recommendedLevel } = route.params;
  const accuracy = questionsCount === 0 ? 0 : Math.round((correctCount / questionsCount) * 100);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === "diagnostic" ? "Diagnóstico concluído" : "Sessão concluída"}</Text>

      <View style={styles.card}>
        <Text style={styles.points}>+{totalPoints} pontos</Text>
        <Text style={styles.stat}>
          {correctCount} de {questionsCount} corretas ({accuracy}%)
        </Text>
        <Text style={styles.level}>
          {mode === "diagnostic" ? "Nível recomendado: " : "Seu novo nível: "}
          <Text style={styles.levelHighlight}>{LEVEL_LABEL[recommendedLevel]}</Text>
        </Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => navigation.replace("Quiz", { mode: "practice", difficulty: recommendedLevel })}
      >
        <Text style={styles.buttonText}>Praticar mais</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.secondaryButtonText}>Voltar ao início</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f8fafc", justifyContent: "center", gap: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 24, alignItems: "center", gap: 8 },
  points: { fontSize: 32, fontWeight: "800", color: "#16a34a" },
  stat: { color: "#334155", fontSize: 16 },
  level: { color: "#334155", fontSize: 16, marginTop: 8 },
  levelHighlight: { fontWeight: "800", color: "#2563eb" },
  button: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { paddingVertical: 12, alignItems: "center" },
  secondaryButtonText: { color: "#334155", fontWeight: "600" },
});
