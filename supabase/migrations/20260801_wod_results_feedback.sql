-- ─────────────────────────────────────────────────────────────────────────────
-- Percepção de esforço no Box
-- Mesmos campos já usados no Diário do Individual (RPE, sensação, sono,
-- notas), agora também disponíveis ao registrar o resultado do WOD no Box.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.wod_results add column if not exists rpe integer;
alter table public.wod_results add column if not exists feeling text;
alter table public.wod_results add column if not exists sleep_hours numeric;
alter table public.wod_results add column if not exists notes text;
