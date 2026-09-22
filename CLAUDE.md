# StudyQuest

## O que é

TCC: aplicativo de estudos adaptativo, multiplataforma (Web, Android, iOS), para quem está se
preparando para certificações/provas técnicas. O usuário estuda por **temas** (ex.: CCNA), é
avaliado por um **teste de nivelamento** que classifica seu conhecimento em três **trilhas**
(iniciante / intermediário / avançado), pratica com **perguntas de múltipla escolha** pontuadas
por dificuldade e velocidade de resposta, e reforça o que aprendeu com **flashcards de repetição
espaçada**. O nivelamento inicial e o acompanhamento dos flashcards são potencializados por IA.
O app funciona em **português e inglês**.

Eixo acadêmico: a proposta combina engenharia de software (app multiplataforma com base de
código compartilhada), IA aplicada a educação (nivelamento adaptativo, avaliação de recall em
flashcards) e modelagem de dados (agendamento de repetição espaçada, RLS multi-usuário).

## Stack e arquitetura

- **Monorepo `pnpm`**: `apps/web` (Next.js App Router + Tailwind), `apps/mobile` (Expo/React
  Native), `packages/shared` (TypeScript puro, sem UI — tipos de domínio, cliente Supabase,
  regras de pontuação/nivelamento, chamadas ao banco). Web e mobile importam a lógica de
  `@studyquest/shared` em vez de duplicá-la.
- **Backend = Supabase** (Postgres + Auth). Sem servidor próprio: os apps falam direto com o
  Supabase via `anon key`, protegidos por **Row Level Security** (cada usuário só lê/escreve os
  próprios dados de progresso; conteúdo — temas/perguntas/flashcards — é de leitura pública).
- **Sem chave de IA no cliente.** Qualquer chamada a um provedor de IA (hoje: Google Gemini)
  precisa passar por uma **Supabase Edge Function** (`supabase/functions/`), que guarda a API
  key como secret do projeto — nunca embutir a chave em `apps/web` ou `apps/mobile`.

## Estado atual (implementado)

- Cadastro/login por e-mail+senha via Supabase Auth (`AuthContext` em web e mobile). Trigger
  `handle_new_user` cria a linha em `profiles` automaticamente no cadastro.
- **Multi-tema**: `tracks` não é mais fixo em `"ccna"`. Dashboard/Home listam todas as trilhas
  (`getTracks`) e cada uma tem seu próprio nível; hoje existem duas trilhas de exemplo — CCNA
  (`supabase/seed.sql`, com as 18 perguntas revisadas por `supabase/seed_revise_ccna_questions.sql`)
  e Lógica de Programação (`supabase/seed_fase0_logica_programacao.sql`).
- **Nível de jogador (XP)**: `packages/shared/src/playerLevel.ts`, gamificação separada do
  nivelamento iniciante/intermediário/avançado — sobe com o total de pontos do perfil, curva de
  XP triangular. Mostrado no dashboard/home e no perfil, web e mobile.
- Diagnóstico inicial e sessões de prática (`quiz/page.tsx` web, `QuizScreen.tsx` mobile): busca
  perguntas via `get_diagnostic_questions`/`get_practice_questions` (RPCs `SECURITY DEFINER`,
  migration `0003_ai_question_generation.sql`) — **sem gabarito**, com alternativas já
  embaralhadas no servidor e priorizando perguntas inéditas para aquele aluno (depois as que ele
  errou). Corrige a resposta **no servidor** via RPC `submit_quiz_answer`, grava em
  `quiz_answers`.
- **Correção no servidor**: desde a migration `0003`, `anon`/`authenticated` não têm mais
  nenhum `SELECT` direto em `questions` (revogado por completo — antes era por coluna). Todo
  acesso passa pelas RPCs `SECURITY DEFINER` acima. A fórmula de pontos está duplicada em SQL
  (`submit_quiz_answer`) e em `packages/shared/src/scoring.ts`; **mudar uma sem mudar a outra é
  um bug** (comentado nos dois lugares).
- **Geração de perguntas por IA (Google Gemini)**: Edge Function
  `supabase/functions/generate-question-batch` — chama o Gemini duas vezes (gera um lote de 10
  perguntas com regras rígidas de qualidade no prompt, depois valida cada uma independentemente
  antes de aprovar). Só perguntas aprovadas entram com `status = 'active'`; as reprovadas ficam
  salvas como `'rejected'` (dado de avaliação para o TCC). Disparada automaticamente pelo app
  quando `get_practice_questions` sinaliza `low_inventory` (poucas perguntas inéditas restando
  para aquele tema/nível) — não gera em tempo real durante o quiz, só repõe o estoque pra
  próxima vez. Registro de cada lote em `question_generation_batches`.
- **Reportar pergunta**: botão no quiz (web e mobile) chama a RPC `report_question`; após 3
  reports distintos, a pergunta sai de circulação automaticamente (`status = 'retired'`, trigger
  `retire_question_on_reports`).
- **Métricas por pergunta**: view `question_metrics` (taxa de acerto, tempo médio, reports) —
  só consultável direto no SQL Editor com a service_role key, não exposta ao app.
- Pontuação (`packages/shared/src/scoring.ts`): pontos base por dificuldade × multiplicador de
  velocidade (0.5x a 2x conforme o tempo usado). Resposta errada nunca pontua.
- Nivelamento (`packages/shared/src/adaptive.ts`): **regra fixa por acurácia**, não usa IA.
  `suggestStartingLevel` (diagnóstico) e `suggestNextLevel` (após cada sessão de prática, sobe
  com ≥80% de acerto, desce com <40%). O nível atual do usuário por trilha fica em
  `user_track_levels` (uma linha por usuário+trilha), sincronizado entre dispositivos.
- Perfil com pontos totais e ranking simples (`profiles.total_points`, somado por trigger
  `apply_session_points_to_profile` quando uma sessão é finalizada).
- Só português. Nenhum texto de UI está preparado para tradução (strings soltas no JSX) — é a
  Fase 1. O schema de `questions` já tem `locale` (`'pt'`/`'en'`) e a geração por IA já suporta
  gerar em inglês, mas nenhuma tela deixa o aluno trocar de idioma ainda.
- Nenhum flashcard, nenhuma repetição espaçada ainda.

## Dívidas técnicas conhecidas

- **Fórmula de pontos duplicada** (SQL em `submit_quiz_answer` e TypeScript em `scoring.ts`):
  necessário porque a correção roda no Postgres, não dá pra chamar código TS de lá. Ao mexer em
  uma, conferir a outra.
- Ainda sem seleção de idioma nem conteúdo traduzido na UI (Fase 1 do plano).
- A Edge Function de geração usa a API REST do Gemini via `fetch` direto (sem SDK) — o nome do
  modelo (`GEMINI_MODEL`, default `gemini-2.0-flash`) e o formato de `responseSchema` podem
  precisar de ajuste quando testados contra uma key real, já que não há verificação automatizada
  desse provedor neste repositório.

## Como rodar / testar

Ver `README.md` na raiz — inclui setup do Supabase (migration + seed), variáveis de ambiente de
cada app, e `pnpm dev:web` / `pnpm dev:mobile`. Testes de lógica pura ficam em
`packages/shared/src/*.test.ts` (`pnpm --filter @studyquest/shared test`).

## Convenções

- Sem comentários explicando o óbvio; só quando há uma decisão não-óbvia por trás do código.
- Português nos textos de UI e nos commits; nomes de variáveis/funções em inglês, como já está.
- Schema do banco sempre via arquivo de migration novo em `supabase/migrations/`, nunca editando
  uma migration já commitada (mesmo que ainda não tenha rodado em produção, evita divergência
  entre o que está no repo e o que já foi aplicado manualmente no painel do Supabase).
- Lógica que web e mobile precisam dos dois (regras de negócio, tipos, chamadas ao Supabase) vai
  em `packages/shared`, nunca duplicada entre os dois apps.
