import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  finishSession,
  getDiagnosticQuestions,
  getPracticeQuestions,
  getTrackBySlug,
  getTrackLevel,
  reportQuestion,
  setTrackLevel,
  startSession,
  submitAnswer,
  suggestNextLevel,
  suggestStartingLevel,
  type Difficulty,
  type GradedAnswer,
  type Question,
  type QuizSession,
  type ReportReason,
} from "@studyquest/shared";

type Props = NativeStackScreenProps<RootStackParamList, "Quiz">;

type DifficultyTally = Record<Difficulty, { correct: number; total: number }>;

const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  gabarito_errado: "Gabarito errado",
  traducao_ruim: "Tradução ruim",
  confusa: "Pergunta confusa",
  duplicada: "Duplicada",
  outro: "Outro motivo",
};

function ratio({ correct, total }: { correct: number; total: number }): number {
  return total === 0 ? 0 : correct / total;
}

function triggerLowInventoryGeneration(trackId: string, difficulty: Difficulty) {
  void supabase.functions
    .invoke("generate-question-batch", { body: { trackId, difficulty, locale: "pt", count: 10 } })
    .catch(() => {
      // melhor esforço: se falhar, o app segue funcionando com o estoque atual
    });
}

export default function QuizScreen({ route, navigation }: Props) {
  const { trackSlug, mode, difficulty } = route.params;
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answered, setAnswered] = useState<GradedAnswer | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportedQuestionIds, setReportedQuestionIds] = useState<Set<string>>(new Set());
  const [perDifficulty, setPerDifficulty] = useState<DifficultyTally>({
    iniciante: { correct: 0, total: 0 },
    intermediario: { correct: 0, total: 0 },
    avancado: { correct: 0, total: 0 },
  });

  const questionStartedAt = useRef(Date.now());
  const trackIdRef = useRef<string | null>(null);
  const currentQuestion = questions[index];

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      if (!session) return;
      const track = await getTrackBySlug(supabase, trackSlug);
      trackIdRef.current = track.id;

      let loadedQuestions: Question[];
      if (mode === "diagnostic") {
        loadedQuestions = await getDiagnosticQuestions(supabase, track.id, "pt", 3);
      } else {
        const effectiveDifficulty = difficulty ?? "iniciante";
        const result = await getPracticeQuestions(supabase, track.id, effectiveDifficulty, "pt", 8);
        loadedQuestions = result.questions;
        if (result.lowInventory) triggerLowInventoryGeneration(track.id, effectiveDifficulty);
      }

      const createdSession = await startSession(supabase, {
        userId: session.user.id,
        trackId: track.id,
        mode,
        difficulty: mode === "practice" ? difficulty : null,
      });
      if (cancelled) return;
      setQuestions(loadedQuestions);
      setQuizSession(createdSession);
      setLoading(false);
      questionStartedAt.current = Date.now();
    }
    setup();
    return () => {
      cancelled = true;
    };
  }, [session, trackSlug, mode, difficulty]);

  useEffect(() => {
    if (!currentQuestion || answered) return;
    setSecondsLeft(currentQuestion.timeLimitSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleAnswer("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, answered]);

  async function handleAnswer(selectedOptionId: string) {
    if (!quizSession || !currentQuestion || answered) return;
    const timeTakenMs = Date.now() - questionStartedAt.current;
    const graded = await submitAnswer(supabase, quizSession, currentQuestion, {
      questionId: currentQuestion.id,
      selectedOptionId,
      timeTakenMs,
    });
    setAnswered(graded);
    setTotalPoints((prev) => prev + graded.pointsAwarded);
    setCorrectCount((prev) => prev + (graded.isCorrect ? 1 : 0));
    setPerDifficulty((prev) => ({
      ...prev,
      [currentQuestion.difficulty]: {
        correct: prev[currentQuestion.difficulty].correct + (graded.isCorrect ? 1 : 0),
        total: prev[currentQuestion.difficulty].total + 1,
      },
    }));
  }

  async function handleReport(reason: ReportReason) {
    if (!currentQuestion) return;
    await reportQuestion(supabase, currentQuestion.id, reason);
    setReportedQuestionIds((prev) => new Set(prev).add(currentQuestion.id));
    setReportOpen(false);
  }

  async function handleNext() {
    if (index + 1 < questions.length) {
      setAnswered(null);
      setReportOpen(false);
      setIndex((prev) => prev + 1);
      questionStartedAt.current = Date.now();
      return;
    }
    await finish();
  }

  async function finish() {
    if (!quizSession || !session || !trackIdRef.current) return;

    await finishSession(supabase, quizSession.id, {
      totalPoints,
      questionsCount: questions.length,
      correctCount,
    });

    let recommendedLevel: Difficulty;
    if (mode === "diagnostic") {
      recommendedLevel = suggestStartingLevel({
        iniciante: ratio(perDifficulty.iniciante),
        intermediario: ratio(perDifficulty.intermediario),
        avancado: ratio(perDifficulty.avancado),
      });
    } else {
      const currentLevel = difficulty ?? (await getTrackLevel(supabase, session.user.id, trackIdRef.current)) ?? "iniciante";
      recommendedLevel = suggestNextLevel(currentLevel, correctCount / questions.length);
    }
    await setTrackLevel(supabase, session.user.id, trackIdRef.current, recommendedLevel);

    navigation.replace("Results", {
      trackSlug,
      mode,
      totalPoints,
      correctCount,
      questionsCount: questions.length,
      recommendedLevel,
    });
  }

  if (loading || !currentQuestion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const alreadyReported = reportedQuestionIds.has(currentQuestion.id);

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Pergunta {index + 1} de {questions.length}
        </Text>
        <Text style={[styles.timer, secondsLeft <= 5 && styles.timerUrgent]}>{secondsLeft}s</Text>
      </View>

      <View style={styles.badgeRow}>
        <Text style={styles.difficultyBadge}>{currentQuestion.difficulty.toUpperCase()}</Text>
        <Pressable onPress={() => setReportOpen((prev) => !prev)} disabled={alreadyReported}>
          <Text style={styles.reportLink}>{alreadyReported ? "Reportado" : "Reportar pergunta"}</Text>
        </Pressable>
      </View>

      {reportOpen ? (
        <View style={styles.reportPanel}>
          <Text style={styles.reportPanelTitle}>Qual o problema?</Text>
          <View style={styles.reportOptions}>
            {(Object.keys(REPORT_REASON_LABEL) as ReportReason[]).map((reason) => (
              <Pressable key={reason} style={styles.reportOption} onPress={() => void handleReport(reason)}>
                <Text style={styles.reportOptionText}>{REPORT_REASON_LABEL[reason]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.prompt}>{currentQuestion.prompt}</Text>

      <View style={styles.options}>
        {currentQuestion.options.map((option) => {
          const isSelected = answered?.selectedOptionId === option.id;
          const isSelectedWrong = answered && isSelected && !answered.isCorrect;
          const isCorrectOption = answered && option.id === answered.correctOptionId;
          const explanation = answered?.optionExplanations[option.id];
          const showExplanation = answered && explanation && (isSelected || isCorrectOption);

          return (
            <View key={option.id}>
              <Pressable
                style={[styles.option, isSelectedWrong && styles.optionWrong, isCorrectOption && styles.optionCorrect]}
                onPress={() => handleAnswer(option.id)}
                disabled={!!answered}
              >
                <Text style={styles.optionText}>{option.text}</Text>
              </Pressable>
              {showExplanation ? <Text style={styles.optionExplanation}>{explanation}</Text> : null}
            </View>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>
            {answered.isCorrect ? `Certo! +${answered.pointsAwarded} pontos` : "Não foi dessa vez."}
          </Text>
          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>{index + 1 < questions.length ? "Próxima pergunta" : "Ver resultado"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressText: { color: "#475569", fontWeight: "600" },
  timer: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  timerUrgent: { color: "#e11d48" },
  badgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  difficultyBadge: {
    backgroundColor: "#e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  reportLink: { fontSize: 12, fontWeight: "600", color: "#94a3b8" },
  reportPanel: { backgroundColor: "#f1f5f9", borderRadius: 8, padding: 12, marginBottom: 16 },
  reportPanelTitle: { fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 8 },
  reportOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reportOption: {
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reportOptionText: { fontSize: 12, fontWeight: "600", color: "#334155" },
  prompt: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 20 },
  options: { gap: 12 },
  option: { backgroundColor: "#fff", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  optionWrong: { borderColor: "#e11d48", backgroundColor: "#fff1f2" },
  optionCorrect: { borderColor: "#059669", backgroundColor: "#ecfdf5" },
  optionText: { color: "#0f172a", fontWeight: "500" },
  optionExplanation: { marginTop: 4, paddingHorizontal: 4, fontSize: 13, color: "#475569" },
  feedback: { marginTop: 20, gap: 8 },
  feedbackText: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  nextButton: { backgroundColor: "#4f46e5", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  nextButtonText: { color: "#fff", fontWeight: "700" },
});
