-- Fase 0.5: geração de perguntas por IA (lotes revisados antes de entrar em produção),
-- anti-repetição por aluno, embaralhar alternativas no servidor, reportar pergunta com
-- retirada automática, e métricas por pergunta.
--
-- Mudança de arquitetura importante: a partir daqui, TODO acesso a `questions` pelo
-- cliente (anon/authenticated) passa pelas funções abaixo (SECURITY DEFINER), não mais
-- por SELECT direto na tabela. Por isso revogamos até o acesso por coluna que a
-- migration 0002 tinha liberado.

-- ---------------------------------------------------------------------------
-- Novas tabelas
-- ---------------------------------------------------------------------------

create table if not exists question_generation_batches (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks (id),
  difficulty text not null check (difficulty in ('iniciante', 'intermediario', 'avancado')),
  locale text not null check (locale in ('pt', 'en')),
  requested_by uuid references auth.users (id),
  model text not null,
  questions_requested integer not null,
  questions_generated integer not null default 0,
  questions_approved integer not null default 0,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('gabarito_errado', 'traducao_ruim', 'confusa', 'duplicada', 'outro')),
  detail text,
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

alter table question_generation_batches enable row level security;
alter table question_reports enable row level security;
-- Sem políticas permissivas: acesso só via report_question() e pela Edge Function
-- (que usa a service_role key, que ignora RLS).

-- ---------------------------------------------------------------------------
-- questions: novas colunas
-- ---------------------------------------------------------------------------

alter table questions
  add column if not exists locale text not null default 'pt' check (locale in ('pt', 'en')),
  add column if not exists status text not null default 'active'
    check (status in ('pending_review', 'active', 'rejected', 'retired')),
  add column if not exists source text not null default 'seed' check (source in ('seed', 'ai_generated')),
  add column if not exists generation_batch_id uuid references question_generation_batches (id),
  add column if not exists option_explanations jsonb;

-- explanation (1 texto só, a explicação da correta) é substituída por option_explanations
-- (um mapa {id_da_alternativa: explicação}, uma por alternativa — inclusive as erradas)
alter table questions drop column if exists explanation;

create index if not exists questions_track_difficulty_locale_status_idx
  on questions (track_id, difficulty, locale, status);

-- ---------------------------------------------------------------------------
-- Retirar pergunta de circulação automaticamente após 3 reports distintos
-- ---------------------------------------------------------------------------

create or replace function retire_question_on_reports()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_report_count integer;
begin
  select count(*) into v_report_count from question_reports where question_id = new.question_id;
  if v_report_count >= 3 then
    update questions set status = 'retired' where id = new.question_id and status <> 'retired';
  end if;
  return new;
end;
$$;

drop trigger if exists on_question_report_insert on question_reports;
create trigger on_question_report_insert
  after insert on question_reports
  for each row execute function retire_question_on_reports();

-- ---------------------------------------------------------------------------
-- Métricas por pergunta (consultar direto no SQL Editor — não é exposta ao app)
-- ---------------------------------------------------------------------------

create or replace view question_metrics as
select
  q.id as question_id,
  q.track_id,
  q.difficulty,
  q.locale,
  q.status,
  q.source,
  count(qa.*) as answers_count,
  count(qa.*) filter (where qa.is_correct) as correct_count,
  round(coalesce(avg(qa.is_correct::int), 0)::numeric, 3) as accuracy,
  round(coalesce(avg(qa.time_taken_ms), 0)::numeric, 0) as avg_time_taken_ms,
  (select count(*) from question_reports r where r.question_id = q.id) as reports_count
from questions q
left join quiz_answers qa on qa.question_id = q.id
group by q.id;

revoke select on question_metrics from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fecha o acesso direto a questions: só pelas funções abaixo daqui pra frente
-- ---------------------------------------------------------------------------

revoke select on questions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_practice_questions: prioriza perguntas inéditas para o aluno, depois as que
-- ele errou, embaralha a ordem das alternativas, e avisa quando o estoque de
-- perguntas inéditas está baixo (pra disparar geração de um novo lote).
-- ---------------------------------------------------------------------------

drop function if exists get_practice_questions(uuid, text, text, integer);

create or replace function get_practice_questions(
  p_track_id uuid,
  p_difficulty text,
  p_locale text default 'pt',
  p_count integer default 8
)
returns table (questions jsonb, low_inventory boolean)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select
      q.id, q.prompt, q.options, q.time_limit_seconds, q.difficulty,
      exists (
        select 1 from quiz_answers qa
        join quiz_sessions qs on qs.id = qa.session_id
        where qa.question_id = q.id and qs.user_id = auth.uid()
      ) as seen,
      exists (
        select 1 from quiz_answers qa
        join quiz_sessions qs on qs.id = qa.session_id
        where qa.question_id = q.id and qs.user_id = auth.uid() and qa.is_correct = false
      ) as seen_wrong
    from questions q
    where q.track_id = p_track_id
      and q.difficulty = p_difficulty
      and q.locale = p_locale
      and q.status = 'active'
  ),
  picked as (
    select
      c.id, c.prompt, c.time_limit_seconds, c.difficulty,
      (select jsonb_agg(elem order by random()) from jsonb_array_elements(c.options) elem) as options
    from candidates c
    order by (not c.seen) desc, c.seen_wrong desc, random()
    limit p_count
  )
  select
    coalesce((select jsonb_agg(to_jsonb(picked)) from picked), '[]'::jsonb),
    (select count(*) from candidates where not seen) < p_count
$$;

revoke all on function get_practice_questions(uuid, text, text, integer) from public;
grant execute on function get_practice_questions(uuid, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- get_diagnostic_questions: mistura os 3 níveis, embaralha alternativas e ordem
-- ---------------------------------------------------------------------------

drop function if exists get_diagnostic_questions(uuid, text, integer);

create or replace function get_diagnostic_questions(
  p_track_id uuid,
  p_locale text default 'pt',
  p_count_per_level integer default 3
)
returns table (questions jsonb)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select
      q.id, q.prompt, q.options, q.time_limit_seconds, q.difficulty,
      row_number() over (partition by q.difficulty order by random()) as rn
    from questions q
    where q.track_id = p_track_id
      and q.locale = p_locale
      and q.status = 'active'
  ),
  picked as (
    select
      c.id, c.prompt, c.time_limit_seconds, c.difficulty,
      (select jsonb_agg(elem order by random()) from jsonb_array_elements(c.options) elem) as options
    from candidates c
    where c.rn <= p_count_per_level
  )
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  from (select * from picked order by random()) p
$$;

revoke all on function get_diagnostic_questions(uuid, text, integer) from public;
grant execute on function get_diagnostic_questions(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- report_question: aluno sinaliza uma pergunta com problema
-- ---------------------------------------------------------------------------

create or replace function report_question(
  p_question_id uuid,
  p_reason text,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into question_reports (question_id, user_id, reason, detail)
  values (p_question_id, auth.uid(), p_reason, p_detail)
  on conflict (question_id, user_id) do nothing;
end;
$$;

revoke all on function report_question(uuid, text, text) from public;
grant execute on function report_question(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_quiz_answer: agora devolve option_explanations (todas as 4, não só a
-- certa) em vez de um único texto de explicação, que não existe mais na tabela.
-- ---------------------------------------------------------------------------

drop function if exists submit_quiz_answer(uuid, uuid, text, integer);

create or replace function submit_quiz_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option_id text,
  p_time_taken_ms integer
)
returns table (
  is_correct boolean,
  points_awarded integer,
  correct_option_id text,
  option_explanations jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct_option_id text;
  v_difficulty text;
  v_time_limit_seconds integer;
  v_option_explanations jsonb;
  v_base_points integer;
  v_used_fraction numeric;
  v_multiplier numeric;
  v_is_correct boolean;
  v_points integer;
begin
  if p_time_taken_ms is null or p_time_taken_ms < 0 then
    raise exception 'time_taken_ms inválido';
  end if;

  if not exists (
    select 1 from quiz_sessions
    where quiz_sessions.id = p_session_id and quiz_sessions.user_id = auth.uid()
  ) then
    raise exception 'sessão inválida ou não pertence ao usuário autenticado';
  end if;

  select questions.correct_option_id, questions.difficulty, questions.time_limit_seconds,
         questions.option_explanations
    into v_correct_option_id, v_difficulty, v_time_limit_seconds, v_option_explanations
  from questions
  where questions.id = p_question_id;

  if not found then
    raise exception 'pergunta não encontrada';
  end if;

  v_is_correct := (p_selected_option_id = v_correct_option_id);

  -- Mantém em sincronia com BASE_POINTS em packages/shared/src/scoring.ts
  v_base_points := case v_difficulty
    when 'iniciante' then 10
    when 'intermediario' then 20
    when 'avancado' then 35
    else 0
  end;

  -- Mesma fórmula de speedMultiplier em packages/shared/src/scoring.ts (0.5x a 2x)
  v_used_fraction := least(greatest(p_time_taken_ms::numeric / greatest(v_time_limit_seconds, 1) / 1000, 0), 1);
  v_multiplier := 2.0 - (2.0 - 0.5) * v_used_fraction;

  v_points := case when v_is_correct then round(v_base_points * v_multiplier) else 0 end;

  insert into quiz_answers (session_id, question_id, selected_option_id, is_correct, time_taken_ms, points_awarded)
  values (p_session_id, p_question_id, p_selected_option_id, v_is_correct, p_time_taken_ms, v_points);

  return query select v_is_correct, v_points, v_correct_option_id, v_option_explanations;
end;
$$;

revoke all on function submit_quiz_answer(uuid, uuid, text, integer) from public;
grant execute on function submit_quiz_answer(uuid, uuid, text, integer) to authenticated;
