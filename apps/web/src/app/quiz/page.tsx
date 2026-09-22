"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
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
  type QuizMode,
  type QuizSession,
  type ReportReason,
} from "@studyquest/shared";

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

/** Dispara a geração de um novo lote em segundo plano; não bloqueia o aluno. */
function triggerLowInventoryGeneration(trackId: string, difficulty: Difficulty) {
  void supabase.functions
    .invoke("generate-question-batch", { body: { trackId, difficulty, locale: "pt", count: 10 } })
    .catch(() => {
      // melhor esforço: se falhar, o app segue funcionando com o estoque atual
    });
}

function QuizContent() {
  const searchParams = useSearchParams();
  const trackSlug = searchParams.get("track") ?? "ccna";
  const mode = (searchParams.get("mode") as QuizMode | null) ?? "practice";
  const difficulty = searchParams.get("difficulty") as Difficulty | null;

  const { session } = useAuth();
  const router = useRouter();

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia o cronômetro a cada pergunta
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

    const params = new URLSearchParams({
      track: trackSlug,
      mode,
      totalPoints: String(totalPoints),
      correctCount: String(correctCount),
      questionsCount: String(questions.length),
      recommendedLevel,
    });
    router.replace(`/results?${params.toString()}`);
  }

  if (loading || !currentQuestion) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  const alreadyReported = reportedQuestionIds.has(currentQuestion.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-semibold text-slate-600">
          Pergunta {index + 1} de {questions.length}
        </span>
        <span className={`text-lg font-extrabold ${secondsLeft <= 5 ? "text-rose-600" : "text-slate-900"}`}>
          {secondsLeft}s
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="inline-block rounded-md bg-slate-200 px-2 py-1 text-xs font-bold uppercase text-slate-700">
          {currentQuestion.difficulty}
        </span>
        <button
          onClick={() => setReportOpen((prev) => !prev)}
          disabled={alreadyReported}
          className="text-xs font-semibold text-slate-400 hover:text-rose-600 disabled:hover:text-slate-400"
        >
          {alreadyReported ? "Reportado" : "Reportar pergunta"}
        </button>
      </div>

      {reportOpen ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Qual o problema?</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REPORT_REASON_LABEL) as ReportReason[]).map((reason) => (
              <button
                key={reason}
                onClick={() => void handleReport(reason)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {REPORT_REASON_LABEL[reason]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <h1 className="mb-6 text-xl font-bold text-slate-900">{currentQuestion.prompt}</h1>

      <div className="space-y-3">
        {currentQuestion.options.map((option) => {
          const isSelected = answered?.selectedOptionId === option.id;
          const isSelectedWrong = answered && isSelected && !answered.isCorrect;
          const isCorrectOption = answered && option.id === answered.correctOptionId;
          const explanation = answered?.optionExplanations[option.id];
          const showExplanation = answered && explanation && (isSelected || isCorrectOption);

          return (
            <div key={option.id}>
              <button
                onClick={() => handleAnswer(option.id)}
                disabled={!!answered}
                className={`w-full rounded-lg border px-4 py-3 text-left font-medium transition-colors ${
                  isSelectedWrong
                    ? "border-rose-500 bg-rose-50"
                    : isCorrectOption
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-300 bg-white hover:bg-slate-50"
                }`}
              >
                {option.text}
              </button>
              {showExplanation ? <p className="mt-1 px-1 text-sm text-slate-600">{explanation}</p> : null}
            </div>
          );
        })}
      </div>

      {answered ? (
        <div className="mt-6 space-y-3">
          <p className="text-lg font-bold text-slate-900">
            {answered.isCorrect ? `Certo! +${answered.pointsAwarded} pontos` : "Não foi dessa vez."}
          </p>
          <button
            onClick={() => void handleNext()}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {index + 1 < questions.length ? "Próxima pergunta" : "Ver resultado"}
          </button>
        </div>
      ) : null}
    </main>
  );
}

export default function QuizPage() {
  return (
    <RequireAuth>
      <Suspense>
        <QuizContent />
      </Suspense>
    </RequireAuth>
  );
}
