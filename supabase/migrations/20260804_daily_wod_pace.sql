-- Ritmo (reps/min) no Placar de WODs do individual — paridade com o que o
-- coach cadastra no WOD do Box (total_reps). Só cobre FOR TIME por ora: sem
-- um "reps por round" cadastrado (o atleta não prescreve rounds fixos, ao
-- contrário do coach), o AMRAP registrado pelo cronômetro ("rounds+reps")
-- não tem como virar reps totais de forma confiável.

alter table public.daily_wod_results
  add column if not exists total_reps integer;

comment on column public.daily_wod_results.total_reps is
  'Total de reps prescritas no WOD (FOR TIME). Com o tempo do resultado vira ritmo (reps/min) — mesmo cálculo do Box.';

-- Esforço (FC): hr_avg_pct e effort_index já existiam aqui desde
-- 20260725_wod_effort.sql, mas nunca eram gravados pelo cronômetro — só iam
-- pro diário. hr_zone (zona dominante) só existia em training_logs;
-- completando o trio aqui também, pra aparecer no placar.
alter table public.daily_wod_results
  add column if not exists hr_zone text;
