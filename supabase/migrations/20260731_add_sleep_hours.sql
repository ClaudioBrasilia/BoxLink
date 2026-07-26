-- ─────────────────────────────────────────────────────────────────────────────
-- Sono x desempenho
-- Horas de sono da noite anterior, registradas junto ao treino no Diário,
-- para cruzar com RPE/sensação em Insights.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.training_logs add column if not exists sleep_hours numeric;
