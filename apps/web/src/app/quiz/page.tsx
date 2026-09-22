"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getStoredLevel, setStoredLevel } from "@/lib/levelStorage";
import {
  finishSession,
  getDiagnosticQuestions,
  getPracticeQuestions,
  getTrackBySlug,
  startSession,
  submitAnswer,
  suggestNextLevel,
  suggestStartingLevel,
  type Difficulty,
  type GradedAnswer,
  type Question,
  type QuizMode,
  type QuizSession,
} from "@studyquest/shared";

type DifficultyTally = Record<Difficulty, { correct: number; total: number }>;

function ratio({ correct, total }: { correct: number; total: number }): number {
  return total === 0 ? 0 : correct / total;
}

function QuizContent() {
  const searchParams = useSearchParams();
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
      const track = await getTrackBySlug(supabase, "ccna");
      trackIdRef.current = track.id;
      const loadedQuestions =
        mode === "diagnostic"
          ? await getDiagnosticQuestions(supabase, track.id, 3)
          : await getPracticeQuestions(supabase, track.id, difficulty ?? "iniciante", 8);
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
  }, [session, mode, difficulty]);

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

  async function handleNext() {
    if (index + 1 < questions.length) {
      setAnswered(null);
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
      const currentLevel = difficulty ?? getStoredLevel(session.user.id, trackIdRef.current) ?? "iniciante";
      recommendedLevel = suggestNextLevel(currentLevel, correctCount / questions.length);
    }
    setStoredLevel(session.user.id, trackIdRef.current, recommendedLevel);

    const params = new URLSearchParams({
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

      <span className="mb-3 inline-block rounded-md bg-slate-200 px-2 py-1 text-xs font-bold uppercase text-slate-700">
        {currentQuestion.difficulty}
      </span>
      <h1 className="mb-6 text-xl font-bold text-slate-900">{currentQuestion.prompt}</h1>

      <div className="space-y-3">
        {currentQuestion.options.map((option) => {
          const isSelectedWrong = answered && answered.selectedOptionId === option.id && !answered.isCorrect;
          const isCorrectOption = answered && option.id === answered.correctOptionId;
          return (
            <button
              key={option.id}
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
          );
        })}
      </div>

      {answered ? (
        <div className="mt-6 space-y-3">
          <p className="text-lg font-bold text-slate-900">
            {answered.isCorrect ? `Certo! +${answered.pointsAwarded} pontos` : "Não foi dessa vez."}
          </p>
          {answered.explanation ? <p className="text-slate-600">{answered.explanation}</p> : null}
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
