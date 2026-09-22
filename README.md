# StudyQuest

Aplicativo de estudos adaptativo para certificações técnicas (ex.: **CCNA**), disponível em
**Web**, **Android** e **iOS** a partir da mesma base de código.

A pessoa cria uma conta, faz um **diagnóstico inicial** com perguntas breves dos três níveis
(iniciante, intermediário, avançado) e o app recomenda por onde começar. A partir daí, cada
sessão de prática concede **pontos de acordo com a dificuldade da pergunta e a velocidade da
resposta**, e o desempenho da sessão ajusta o nível seguinte (sobe com boa performance, desce
com desempenho fraco).

## Arquitetura

| Camada | Tecnologia | Por quê |
|---|---|---|
| Mobile (Android/iOS) | React Native + Expo | Apps nativos reais, publicáveis nas lojas |
| Web | Next.js (App Router) + Tailwind | Site próprio com boa qualidade de SSR/SEO |
| Lógica compartilhada | `packages/shared` (TypeScript) | Tipos, pontuação e nivelamento adaptativo usados por web e mobile, sem duplicação |
| Backend | Supabase (Postgres + Auth) | Banco relacional real com autenticação gerenciada, sem precisar manter um servidor próprio |

```
apps/
  web/      → Next.js (site)
  mobile/   → Expo / React Native (Android + iOS)
packages/
  shared/   → tipos, cliente Supabase, cálculo de pontos, nivelamento adaptativo, nível de jogador
supabase/
  migrations/0001_init.sql → schema inicial (tabelas, triggers, RLS)
  migrations/0002_...sql   → correção de respostas no servidor, nível por trilha no banco
  migrations/0003_...sql   → geração de perguntas por IA, anti-repetição, reports, métricas
  functions/generate-question-batch/ → Edge Function (Gemini) que gera e valida lotes de perguntas
  seed.sql                           → trilha CCNA de exemplo (perguntas revisadas por seed_revise_ccna_questions.sql)
  seed_fase0_logica_programacao.sql  → segunda trilha de exemplo
```

Monorepo gerenciado com **pnpm workspaces**. Tanto o Next.js quanto o Metro (bundler do Expo)
importam `@studyquest/shared` diretamente do código-fonte TypeScript (sem passo de build
separado).

### Modelo de dados (Supabase/Postgres)

- `tracks` / `categories` / `questions` — conteúdo de estudo, leitura pública (RLS `select`
  liberado para todos; sem escrita pelo cliente).
- `profiles` — 1 linha por usuário (criada automaticamente por trigger no cadastro), com
  `total_points` acumulado.
- `quiz_sessions` / `quiz_answers` — cada sessão (diagnóstico ou prática) e suas respostas,
  visíveis apenas para o próprio usuário via RLS.
- Um trigger em `quiz_sessions` soma `total_points` da sessão ao perfil assim que
  `finished_at` é preenchido — a lógica de "fechar a sessão" fica garantida no banco,
  independente de vir do app web ou mobile.

### Pontuação e nivelamento adaptativo (`packages/shared/src`)

- `scoring.ts`: pontos base por dificuldade (iniciante/intermediário/avançado) multiplicados
  por um fator de velocidade entre **0.5x** (usou todo o tempo) e **2x** (respondeu
  instantaneamente). Resposta errada nunca pontua.
- `adaptive.ts`:
  - `suggestStartingLevel` — a partir da acurácia do diagnóstico em cada nível, recomenda o
    nível inicial.
  - `suggestNextLevel` — após cada sessão de prática, sobe de nível com acurácia ≥ 80%, desce
    com acurácia < 40%, e mantém o nível no meio-termo.
- Ambas as funções têm testes unitários (`vitest`) em `packages/shared/src/*.test.ts`.

### Correção de respostas e nivelamento (Fase 0)

- **Correção no servidor**: `anon`/`authenticated` não têm mais nenhum `SELECT` direto em
  `questions` (revogado por completo desde a migration `0003`). A resposta é conferida pela
  função `submit_quiz_answer` (Postgres, `SECURITY DEFINER`), que calcula os pontos e grava em
  `quiz_answers`; o cliente só recebe o gabarito e as explicações depois de responder. A fórmula
  de pontos existe duplicada em SQL (na função) e em `scoring.ts` — ver `CLAUDE.md` para o
  porquê e o cuidado ao alterar uma sem a outra.
- **Nível atual por trilha** fica em `user_track_levels` (uma linha por usuário+trilha),
  sincronizado entre dispositivos — não é mais local ao aparelho.
- **Nível de jogador (XP)**: `packages/shared/src/playerLevel.ts` — gamificação separada,
  sobe com o total de pontos acumulados no perfil (curva triangular: cada nível pede 100 pontos
  a mais de progresso que o anterior). Mostrado como badge com barra de progresso.

### Geração de perguntas por IA (Fase 0.5)

- **`get_practice_questions`/`get_diagnostic_questions`** (RPCs `SECURITY DEFINER`, migration
  `0003`): buscam perguntas sem gabarito, **embaralham as alternativas no servidor** a cada
  chamada, e priorizam perguntas que o aluno ainda não respondeu (depois as que ele errou).
  `get_practice_questions` também devolve `low_inventory: true` quando restam poucas perguntas
  inéditas para aquele tema/nível/idioma.
- **Edge Function `generate-question-batch`** (`supabase/functions/generate-question-batch/`):
  disparada pelo app quando `low_inventory` é `true` — **não gera perguntas em tempo real
  durante o quiz**, só repõe o estoque para a próxima sessão. Chama o Gemini duas vezes por
  pergunta candidata: uma para gerar o lote (10 perguntas, com regras rígidas de distratores
  plausíveis, alternativas de tamanho parecido, sem vazar a resposta pelo enunciado, proibido
  "todas/nenhuma das anteriores", e uma explicação por alternativa) e outra para **validar cada
  pergunta de forma independente** antes de aprovar. Só as aprovadas entram com
  `status = 'active'`; as reprovadas ficam salvas como `'rejected'` (dado de avaliação para o
  TCC — taxa de rejeição, motivos mais comuns).
- **Reportar pergunta**: botão no quiz chama a RPC `report_question`; após 3 reports distintos,
  a pergunta sai de circulação automaticamente (trigger `retire_question_on_reports`).
- **Métricas**: view `question_metrics` (taxa de acerto, tempo médio, reports por pergunta) —
  só via SQL Editor/service_role, não exposta ao app.

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode, **nessa ordem**, as migrations e os seeds. Duas formas:
   - **SQL Editor** do painel: cole o conteúdo de cada arquivo abaixo e rode, um de cada vez.
   - **Script deste repo** (roda do seu terminal, sem colar no navegador):
     ```bash
     export DATABASE_URL="postgresql://...connection string do Supabase..."  # Settings → Database
     pnpm db:run supabase/migrations/0001_init.sql
     pnpm db:run supabase/migrations/0002_server_side_grading_and_tracks.sql
     pnpm db:run supabase/migrations/0003_ai_question_generation.sql
     pnpm db:run supabase/seed.sql
     pnpm db:run supabase/seed_revise_ccna_questions.sql
     pnpm db:run supabase/seed_fase0_logica_programacao.sql
     ```
     Prefira a connection string da variante **Session pooler** (compatível com redes só-IPv4).
3. Em **Authentication → Providers**, deixe o login por e-mail/senha habilitado (padrão).
4. Copie a **Project URL** e a **anon public key** (Settings → API) para as variáveis de
   ambiente de cada app (veja abaixo).

### Geração de perguntas por IA (Edge Function)

A função em `supabase/functions/generate-question-batch/` só funciona depois de publicada no
seu projeto — precisa da [Supabase CLI](https://supabase.com/docs/guides/cli) instalada
(`npm install -g supabase`):

```bash
supabase login                                    # abre o navegador pra autenticar
supabase link --project-ref <ref-do-seu-projeto>  # o ref aparece na URL do painel
supabase secrets set GEMINI_API_KEY=sua-chave-gratuita-do-ai.google.dev
supabase functions deploy generate-question-batch
```

Sem isso, o app continua funcionando normalmente com as perguntas já cadastradas — só a
reposição automática do estoque (`low_inventory`) fica sem efeito até a função ser publicada.

## Rodando o projeto

Pré-requisitos: Node 20+, [pnpm](https://pnpm.io).

```bash
pnpm install
```

### Web

```bash
cp apps/web/.env.local.example apps/web/.env.local   # preencha com as chaves do Supabase
pnpm dev:web                                          # http://localhost:3000
```

### Mobile (Expo)

```bash
cp apps/mobile/.env.example apps/mobile/.env          # preencha com as chaves do Supabase
pnpm dev:mobile                                       # abre o Metro/Expo Dev Tools
```

Escaneie o QR code com o app **Expo Go** (Android/iOS) ou rode `pnpm --filter @studyquest/mobile android`
/ `... ios` com um emulador configurado.

### Testes e verificação de tipos

```bash
pnpm --filter @studyquest/shared test        # vitest: pontuação e nivelamento adaptativo
pnpm typecheck                                # tsc --noEmit em todos os pacotes
pnpm --filter @studyquest/web build           # build de produção do Next.js
```

## Roadmap

Fase 0 (concluída): multi-tema, correção no servidor, nível persistido no banco. Fase 0.5
(concluída): geração de perguntas por IA, anti-repetição, alternativas embaralhadas no
servidor, reportar pergunta, nível de jogador (XP). Próximas fases do TCC (ver `CLAUDE.md` para
o estado detalhado):

- **Fase 1** — suporte a português e inglês.
- **Fase 2** — trilhas como jornada visual (progresso por nível, não só o dado cru).
- **Fase 3** — teste de nivelamento com IA (perguntas abertas avaliadas pela IA).
- **Fase 4** — flashcards com repetição espaçada (SM-2), com opção de correção por IA ou
  autoavaliação manual.
- **Fase 5** — monitoramento ativo: flashcards extras gerados por IA sobre pontos fracos,
  notificações diárias, sugestão automática de subir/descer de nível.
- **Fase 6** — painel de progresso, testes das partes principais e documentação de arquitetura
  para o capítulo de desenvolvimento do TCC.
