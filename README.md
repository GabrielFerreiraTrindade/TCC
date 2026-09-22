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
  shared/   → tipos, cliente Supabase, cálculo de pontos, nivelamento adaptativo
supabase/
  migrations/0001_init.sql → schema (tabelas, triggers, RLS)
  seed.sql                 → trilha CCNA de exemplo com perguntas nos 3 níveis
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

### Simplificações conscientes deste MVP

- **Correção da resposta no cliente**: `submitAnswer` recebe a pergunta já com o gabarito e
  calcula pontos localmente antes de gravar no Supabase. Isso evita precisar de uma função de
  borda (Edge Function) só para conferir respostas, mas tecnicamente permite inspecionar a
  rede para ver o gabarito antes de responder. Para um ambiente de certificação real, o
  próximo passo seria mover a correção para uma Supabase Edge Function que só devolve
  `PublicQuestion` (tipo já preparado em `types.ts`) ao cliente.
- **Nível atual por trilha fica salvo localmente** (`localStorage` na web, `AsyncStorage` no
  mobile), não em uma tabela. Simples de implementar e suficiente para o MVP; evolução natural
  é uma coluna `profiles_tracks.current_level` no Postgres para sincronizar entre
  dispositivos.

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode a migration e o seed. Duas formas:
   - **SQL Editor** do painel: cole o conteúdo de `supabase/migrations/0001_init.sql` e rode,
     depois cole `supabase/seed.sql` e rode.
   - **Script deste repo** (roda do seu terminal, sem colar no navegador):
     ```bash
     export DATABASE_URL="postgresql://...connection string do Supabase..."  # Settings → Database
     pnpm db:run supabase/migrations/0001_init.sql
     pnpm db:run supabase/seed.sql
     ```
     Prefira a connection string da variante **Session pooler** (compatível com redes só-IPv4).
3. Em **Authentication → Providers**, deixe o login por e-mail/senha habilitado (padrão).
4. Copie a **Project URL** e a **anon public key** (Settings → API) para as variáveis de
   ambiente de cada app (veja abaixo).

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

## Roadmap sugerido

- Mover a correção de respostas para uma Supabase Edge Function (esconder o gabarito do
  cliente).
- Persistir o nível atual por trilha no Postgres (hoje é local ao dispositivo).
- Mais trilhas além do CCNA (basta inserir em `tracks`/`questions`; nenhum código muda).
- Notificações push (Expo Notifications) para lembrar de estudar.
