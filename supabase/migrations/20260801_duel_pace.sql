-- Ritmo (reps/min) em duelos com WOD personalizado (BoxLink Individual).
--
-- Duelos de conta individual sempre têm wod_id = null (o desafio é digitado
-- na hora, em texto livre — ver src/pages/Diario.tsx), então não há como
-- buscar total_reps/time_cap_minutes na tabela `wods` como se faz para
-- duelos de box. Por isso esses dois números também vivem direto na linha
-- do duelo, preenchidos apenas quando o desafiante é Premium (feature
-- premium controlada por PLAN_LIMITS.wodPace em src/lib/plan.ts).

alter table public.duels
  add column if not exists total_reps integer;

alter table public.duels
  add column if not exists time_cap_minutes integer;

comment on column public.duels.total_reps is
  'WOD personalizado por tempo: total de reps prescritas. Usado para o ritmo (reps/min) no recap. Feature Premium.';
comment on column public.duels.time_cap_minutes is
  'WOD personalizado AMRAP: duração em minutos. Usado para o ritmo (reps/min) no recap. Feature Premium.';
