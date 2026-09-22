-- Fase 0: correção de respostas no servidor (o gabarito nunca chega ao cliente antes de
-- responder) e nível do usuário por trilha persistido no banco (antes só ficava local).

-- ---------------------------------------------------------------------------
-- Nível atual do usuário por trilha (substitui o localStorage/AsyncStorage)
-- ---------------------------------------------------------------------------

create table if not exists user_track_levels (
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id uuid not null references tracks (id) on delete cascade,
  level text not null check (level in ('iniciante', 'intermediario', 'avancado')),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

alter table user_track_levels enable row level security;

create policy "user_track_levels_owner_select" on user_track_levels
  for select to authenticated using (auth.uid() = user_id);
create policy "user_track_levels_owner_insert" on user_track_levels
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_track_levels_owner_update" on user_track_levels
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Esconder o gabarito: anon/authenticated deixam de enxergar correct_option_id
-- e explanation na tabela questions. Só a função submit_quiz_answer (abaixo),
-- rodando com privilégio elevado, tem acesso a essas colunas.
-- ---------------------------------------------------------------------------

revoke select on questions from anon, authenticated;
grant select (id, track_id, category_id, difficulty, prompt, options, time_limit_seconds, created_at)
  on questions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Correção da resposta no servidor
-- ---------------------------------------------------------------------------

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
  explanation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct_option_id text;
  v_difficulty text;
  v_time_limit_seconds integer;
  v_explanation text;
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

  -- Os nomes das colunas de questions precisam ser qualificados com "questions.":
  -- RETURNS TABLE já declara correct_option_id/explanation como variáveis de retorno,
  -- e sem qualificação o Postgres não sabe se é a coluna da tabela ou essa variável.
  select questions.correct_option_id, questions.difficulty, questions.time_limit_seconds, questions.explanation
    into v_correct_option_id, v_difficulty, v_time_limit_seconds, v_explanation
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

  return query select v_is_correct, v_points, v_correct_option_id, v_explanation;
end;
$$;

revoke all on function submit_quiz_answer(uuid, uuid, text, integer) from public;
grant execute on function submit_quiz_answer(uuid, uuid, text, integer) to authenticated;
