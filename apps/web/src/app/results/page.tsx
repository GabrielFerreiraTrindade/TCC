"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import type { Difficulty } from "@studyquest/shared";

const LEVEL_LABEL: Record<Difficulty, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = searchParams.get("mode") ?? "practice";
  const totalPoints = Number(searchParams.get("totalPoints") ?? 0);
  const correctCount = Number(searchParams.get("correctCount") ?? 0);
  const questionsCount = Number(searchParams.get("questionsCount") ?? 0);
  const recommendedLevel = (searchParams.get("recommendedLevel") as Difficulty | null) ?? "iniciante";
  const accuracy = questionsCount === 0 ? 0 : Math.round((correctCount / questionsCount) * 100);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">
        {mode === "diagnostic" ? "Diagnóstico concluído" : "Sessão concluída"}
      </h1>

      <div className="w-full space-y-2 rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-4xl font-extrabold text-emerald-600">+{totalPoints} pontos</p>
        <p className="text-slate-700">
          {correctCount} de {questionsCount} corretas ({accuracy}%)
        </p>
        <p className="mt-2 text-slate-700">
          {mode === "diagnostic" ? "Nível recomendado: " : "Seu novo nível: "}
          <span className="font-extrabold text-indigo-600">{LEVEL_LABEL[recommendedLevel]}</span>
        </p>
      </div>

      <button
        onClick={() => router.replace(`/quiz?mode=practice&difficulty=${recommendedLevel}`)}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Praticar mais
      </button>

      <Link href="/dashboard" className="font-semibold text-slate-600 hover:text-slate-900">
        Voltar ao início
      </Link>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <RequireAuth>
      <Suspense>
        <ResultsContent />
      </Suspense>
    </RequireAuth>
  );
}
