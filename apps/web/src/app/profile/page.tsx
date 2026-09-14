"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getLeaderboard, getProfile, type Profile } from "@studyquest/shared";

function ProfileContent() {
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
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-6 py-10">
      <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-lg font-semibold text-slate-900">{profile?.username}</p>
        <p className="text-3xl font-extrabold text-green-600">{profile?.totalPoints ?? 0} pontos</p>
      </div>

      <div>
        <h2 className="mb-3 font-bold text-slate-900">Ranking</h2>
        <ol className="space-y-2">
          {leaderboard.map((entry, position) => (
            <li
              key={entry.id}
              className={`flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ${
                entry.id === profile?.id ? "ring-2 ring-blue-500" : "ring-slate-200"
              }`}
            >
              <span className="w-6 font-bold text-slate-500">{position + 1}</span>
              <span className="flex-1 font-semibold text-slate-900">{entry.username}</span>
              <span className="font-bold text-green-600">{entry.totalPoints}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
