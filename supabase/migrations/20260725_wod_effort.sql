-- ─────────────────────────────────────────────────────────────────────────────
-- Esforço / intensidade (FC) nos treinos e no placar
-- O resultado do WOD passa a carregar o esforço fisiológico medido pela FC
-- durante o "Meu WOD": FC média/máx, % da FC máxima, índice de esforço e zona.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.training_logs add column if not exists hr_avg integer;
alter table public.training_logs add column if not exists hr_max integer;
alter table public.training_logs add column if not exists hr_avg_pct integer;   -- % da FCmáx
alter table public.training_logs add column if not exists effort_index integer;
alter table public.training_logs add column if not exists hr_zone text;         -- zona dominante

-- Placar: intensidade opcional junto ao resultado
alter table public.daily_wod_results add column if not exists hr_avg_pct integer;
alter table public.daily_wod_results add column if not exists effort_index integer;
