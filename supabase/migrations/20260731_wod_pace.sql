-- Ritmo (repetições por minuto) do WOD.
--
-- Para calcular reps/min é preciso saber, além do resultado do atleta, o
-- "tamanho" do WOD em números:
--
--   • FOR TIME  → reps/min = total_reps ÷ tempo gasto pelo atleta
--   • AMRAP     → reps/min = reps completadas ÷ time_cap_minutes
--                 (reps completadas = rounds × reps_per_round + reps extras)
--
-- `reps_per_round` já era usado pelo app (Coach, Wod, Leaderboard) mas nunca
-- teve migration — foi criado direto no painel do Supabase. O `if not exists`
-- abaixo acerta esse desvio sem quebrar quem já tem a coluna.

alter table public.wods
  add column if not exists reps_per_round integer;

alter table public.wods
  add column if not exists total_reps integer;

alter table public.wods
  add column if not exists time_cap_minutes integer;

comment on column public.wods.reps_per_round is
  'AMRAP: repetições de um round completo. Converte "rounds+reps" em total de reps.';
comment on column public.wods.total_reps is
  'FOR TIME: total de repetições prescritas do WOD. Usado para calcular reps/min.';
comment on column public.wods.time_cap_minutes is
  'AMRAP: duração do WOD em minutos. Usado para calcular reps/min.';
