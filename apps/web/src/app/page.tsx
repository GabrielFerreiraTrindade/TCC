import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">Estude por níveis</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">StudyQuest</h1>
        <p className="mt-6 text-lg text-slate-600">
          Prepare-se para certificações como o CCNA respondendo perguntas curtas e intuitivas. Um diagnóstico inicial
          descobre seu nível — iniciante, intermediário ou avançado — e você ganha pontos de acordo com a
          dificuldade e a velocidade de cada resposta.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-indigo-700 sm:w-auto"
          >
            Criar conta
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-slate-300 px-6 py-3 text-center font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
          >
            Já tenho conta
          </Link>
        </div>

        <dl className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="font-semibold text-slate-900">Diagnóstico adaptativo</dt>
            <dd className="mt-1 text-sm text-slate-600">
              Perguntas breves nos três níveis definem por onde você deve começar.
            </dd>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="font-semibold text-slate-900">Pontuação por desempenho</dt>
            <dd className="mt-1 text-sm text-slate-600">
              Perguntas mais difíceis e respostas mais rápidas valem mais pontos.
            </dd>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="font-semibold text-slate-900">Multiplataforma</dt>
            <dd className="mt-1 text-sm text-slate-600">Web, Android e iOS compartilhando a mesma base de estudo.</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
