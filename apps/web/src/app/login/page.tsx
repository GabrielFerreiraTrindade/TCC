"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Entrar</h1>
          <p className="mt-1 text-sm text-slate-600">Continue seus estudos no StudyQuest.</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            required
            placeholder="E-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="password"
            required
            placeholder="Senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Não tem conta?{" "}
          <Link href="/signup" className="font-semibold text-indigo-600 hover:underline">
            Criar conta
          </Link>
        </p>
      </form>
    </main>
  );
}
