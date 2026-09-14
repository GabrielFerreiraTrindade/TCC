-- StudyQuest: schema inicial
-- Conteúdo (tracks/categories/questions) é público para leitura;
-- dados de usuário (profiles/quiz_sessions/quiz_answers) são isolados por RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Conteúdo de estudo
-- ---------------------------------------------------------------------------

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks (id) on delete cascade,
  name text not null
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  difficulty text not null check (difficulty in ('iniciante', 'intermediario', 'avancado')),
  prompt text not null,
  -- options: [{ "id": "a", "text": "..." }, ...]
  options jsonb not null,
  correct_option_id text not null,
  explanation text,
  time_limit_seconds integer not null default 30 check (time_limit_seconds > 0),
  created_at timestamptz not null default now()
);

create index if not exists questions_track_difficulty_idx on questions (track_id, difficulty);

-- ---------------------------------------------------------------------------
-- Usuários e progresso
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_url text,
  total_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id uuid not null references tracks (id) on delete cascade,
  mode text not null check (mode in ('diagnostic', 'practice')),
  difficulty text check (difficulty in ('iniciante', 'intermediario', 'avancado')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_points integer not null default 0,
  questions_count integer not null default 0,
  correct_count integer not null default 0
);

create index if not exists quiz_sessions_user_idx on quiz_sessions (user_id);

create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  selected_option_id text not null,
  is_correct boolean not null,
  time_taken_ms integer not null check (time_taken_ms >= 0),
  points_awarded integer not null default 0,
  answered_at timestamptz not null default now()
);

create index if not exists quiz_answers_session_idx on quiz_answers (session_id);

-- ---------------------------------------------------------------------------
-- Automação: perfil criado no cadastro; pontos somados ao perfil ao concluir sessão
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function apply_session_points_to_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.finished_at is not null and old.finished_at is null then
    update public.profiles
    set total_points = total_points + new.total_points
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_quiz_session_finished on quiz_sessions;
create trigger on_quiz_session_finished
  after update on quiz_sessions
  for each row execute function apply_session_points_to_profile();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table tracks enable row level security;
alter table categories enable row level security;
alter table questions enable row level security;
alter table profiles enable row level security;
alter table quiz_sessions enable row level security;
alter table quiz_answers enable row level security;

-- Conteúdo: leitura pública (inclusive anônima), sem escrita pelo cliente.
create policy "tracks_public_read" on tracks for select using (true);
create policy "categories_public_read" on categories for select using (true);
create policy "questions_public_read" on questions for select using (true);

-- Perfis: qualquer usuário autenticado pode ler (leaderboard); só o dono edita o seu.
create policy "profiles_read_all_authenticated" on profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Sessões e respostas: cada usuário só enxerga e escreve os próprios dados.
create policy "quiz_sessions_owner_select" on quiz_sessions
  for select to authenticated using (auth.uid() = user_id);
create policy "quiz_sessions_owner_insert" on quiz_sessions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "quiz_sessions_owner_update" on quiz_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "quiz_answers_owner_select" on quiz_answers
  for select to authenticated using (
    exists (
      select 1 from quiz_sessions
      where quiz_sessions.id = quiz_answers.session_id
        and quiz_sessions.user_id = auth.uid()
    )
  );
create policy "quiz_answers_owner_insert" on quiz_answers
  for insert to authenticated with check (
    exists (
      select 1 from quiz_sessions
      where quiz_sessions.id = quiz_answers.session_id
        and quiz_sessions.user_id = auth.uid()
    )
  );
