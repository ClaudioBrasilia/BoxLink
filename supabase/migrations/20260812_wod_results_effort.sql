-- Esforço (FC) junto do resultado do WOD do Box.
--
-- O placar do individual (daily_wod_results) já guarda hr_avg_pct,
-- effort_index e hr_zone desde 20260725_wod_effort.sql, e é isso que faz a
-- 4ª barra ("Esforço (FC)") aparecer na comparação entre atletas. No Box a
-- FC só existia ao vivo em heart_rate_live — que expira em minutos —, então
-- o destaque do WOD e a comparação atleta x atleta ficavam sempre com três
-- barras, e o esforço sumia assim que a faixa desconectava.
--
-- As mesmas três colunas aqui fecham essa diferença: o resultado do Box
-- passa a carregar o esforço medido, e a comparação fica igual nos dois apps.

alter table public.wod_results
  add column if not exists hr_avg_pct integer;

alter table public.wod_results
  add column if not exists effort_index integer;

alter table public.wod_results
  add column if not exists hr_zone text;

comment on column public.wod_results.hr_avg_pct is
  'FC média do treino em % da FC máxima teórica (220 − idade). É a métrica comparável entre atletas.';
comment on column public.wod_results.effort_index is
  'Índice de esforço: minutos por zona × peso da zona. Mesma conta do individual (lib/effort.ts).';
comment on column public.wod_results.hr_zone is
  'Zona de FC dominante do treino (onde o atleta passou mais tempo).';
