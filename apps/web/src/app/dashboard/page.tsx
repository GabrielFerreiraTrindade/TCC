"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getStoredLevel } from "@/lib/levelStorage";
import { getProfile, getTrackBySlug, type Difficulty, type Profile, type Track } from "@studyquest/shared";

const LEVEL_LABEL: Record<Difficulty, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

function DashboardContent() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [track, setTrack] = useState<Track | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [level, setLevel] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [trackResult, profileResult] = await Promise.all([
      getTrackBySlug(supabase, "ccna"),
      getProfile(supabase, session.user.id),
    ]);
    setTrack(trackResult);
    setProfile(profileResult);
    setLevel(getStoredLevel(session.user.id, trackResult.id));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de dados do Supabase
    load();
  }, [load]);

  if (loading || !track) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-10">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Olá, {profile?.username}</h1>
        <p className="mt-1 text-3xl font-extrabold text-green-600">{profile?.totalPoints ?? 0} pontos</p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">{track.name}</h2>
        <p className="mt-1 text-slate-600">{track.description}</p>

        {level ? (
          <>
            <p className="mt-4 font-semibold text-slate-800">Seu nível atual: {LEVEL_LABEL[level]}</p>
            <button
              onClick={() => router.push(`/quiz?mode=practice&difficulty=${level}`)}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Praticar ({LEVEL_LABEL[level]})
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 font-semibold text-slate-800">
              Faça o diagnóstico inicial para descobrirmos seu nível.
            </p>
            <button
              onClick={() => router.push("/quiz?mode=diagnostic")}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Iniciar diagnóstico
            </button>
          </>
        )}
      </div>

      <div className="flex justify-center gap-6 text-sm font-semibold text-slate-600">
        <button onClick={() => router.push("/profile")} className="hover:text-slate-900">
          Perfil e ranking
        </button>
        <button onClick={() => void signOut()} className="hover:text-slate-900">
          Sair
        </button>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
