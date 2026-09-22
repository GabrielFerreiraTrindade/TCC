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
- **Sem chave de IA no cliente.** Qualquer chamada a um provedor de IA (Claude, etc.) precisa
  passar por uma **Supabase Edge Function** (ou equivalente) que guarda a API key no servidor —
  nunca embutir a chave em `apps/web` ou `apps/mobile`.

## Estado atual (implementado)

- Cadastro/login por e-mail+senha via Supabase Auth (`AuthContext` em web e mobile). Trigger
  `handle_new_user` cria a linha em `profiles` automaticamente no cadastro.
- **Multi-tema**: `tracks` não é mais fixo em `"ccna"`. Dashboard/Home listam todas as trilhas
  (`getTracks`) e cada uma tem seu próprio nível; hoje existem duas trilhas de exemplo — CCNA
  (`supabase/seed.sql`) e Lógica de Programação (`supabase/seed_fase0_logica_programacao.sql`).
- Diagnóstico inicial e sessões de prática (`quiz/page.tsx` web, `QuizScreen.tsx` mobile):
  busca perguntas (sem gabarito — ver abaixo), cronometra a resposta, corrige **no servidor** via
  RPC `submit_quiz_answer` (migration `0002_server_side_grading_and_tracks.sql`), grava em
  `quiz_answers`.
- **Correção no servidor**: `anon`/`authenticated` não têm mais `SELECT` nas colunas
  `correct_option_id`/`explanation` de `questions` (revogado por `GRANT`/`REVOKE` de coluna). O
  gabarito só existe dentro da função `submit_quiz_answer` (`SECURITY DEFINER`), que confere a
  resposta, calcula os pontos e insere em `quiz_answers` — o cliente só recebe o resultado depois
  de responder. A fórmula de pontos está duplicada em SQL (na função) e em
  `packages/shared/src/scoring.ts`; **mudar uma sem mudar a outra é um bug** (comentado nos dois
  lugares).
- Pontuação (`packages/shared/src/scoring.ts`): pontos base por dificuldade × multiplicador de
  velocidade (0.5x a 2x conforme o tempo usado). Resposta errada nunca pontua.
- Nivelamento (`packages/shared/src/adaptive.ts`): **regra fixa por acurácia**, não usa IA.
  `suggestStartingLevel` (diagnóstico) e `suggestNextLevel` (após cada sessão de prática, sobe
  com ≥80% de acerto, desce com <40%). O nível atual do usuário por trilha fica em
  `user_track_levels` (uma linha por usuário+trilha), sincronizado entre dispositivos.
- Perfil com pontos totais e ranking simples (`profiles.total_points`, somado por trigger
  `apply_session_points_to_profile` quando uma sessão é finalizada).
- Só português. Nenhum texto está preparado para tradução (strings soltas no JSX) — é a Fase 1.
- Nenhum flashcard, nenhuma repetição espaçada, nenhuma chamada de IA ainda.

## Dívidas técnicas conhecidas

- **Fórmula de pontos duplicada** (SQL em `submit_quiz_answer` e TypeScript em `scoring.ts`):
  necessário porque a correção roda no Postgres, não dá pra chamar código TS de lá. Ao mexer em
  uma, conferir a outra.
- Ainda sem seleção de idioma nem conteúdo traduzido (Fase 1 do plano).

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
