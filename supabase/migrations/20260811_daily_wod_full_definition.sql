-- Os números do WOD do individual — os mesmos que o Box guarda em `wods` e
-- que fazem o resultado ser comparável entre atletas.
--
-- Até aqui só existia total_reps (FOR TIME). Sem a duração do AMRAP e as reps
-- de um round completo:
--   • o ritmo (reps/min) do AMRAP era impossível de calcular no placar
--     (ver 20260804_daily_wod_pace.sql, que documentou essa lacuna);
--   • a duração do AMRAP só existia dentro do cronômetro, redigitada a cada
--     treino e perdida depois.
--
-- `target_load_kg` é a carga SUGERIDA do WOD (o que o coach escreveria no RX
-- do Box, ex: "Thruster 43kg"), separada de `load_kg`, que continua sendo a
-- carga que o atleta de fato usou no resultado.

alter table public.daily_wod_results
  add column if not exists reps_per_round integer;

alter table public.daily_wod_results
  add column if not exists time_cap_minutes integer;

alter table public.daily_wod_results
  add column if not exists target_load_kg numeric;

comment on column public.daily_wod_results.reps_per_round is
  'AMRAP: repetições de um round completo. Converte "rounds+reps" em total de reps (mesma conta do Box).';
comment on column public.daily_wod_results.time_cap_minutes is
  'Duração do WOD em minutos: AMRAP/EMOM = duração prescrita, FOR TIME = time cap. Com reps_per_round vira ritmo (reps/min) do AMRAP.';
comment on column public.daily_wod_results.target_load_kg is
  'Carga sugerida (kg) prescrita no WOD. Diferente de load_kg, que é a carga usada no resultado.';
