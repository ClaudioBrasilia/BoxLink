-- Metadados de qualidade para diferenciar HRV válida, ausente, antiga e rejeitada.
-- Compatível com sessões antigas: todas as colunas são opcionais.
ALTER TABLE public.heart_rate_sessions
  ADD COLUMN IF NOT EXISTS hrv_validation_status text,
  ADD COLUMN IF NOT EXISTS hrv_validation_reason text,
  ADD COLUMN IF NOT EXISTS hrv_valid_intervals integer,
  ADD COLUMN IF NOT EXISTS hrv_total_intervals integer,
  ADD COLUMN IF NOT EXISTS hrv_valid_ratio numeric,
  ADD COLUMN IF NOT EXISTS hrv_age_sec integer,
  ADD COLUMN IF NOT EXISTS hrv_source_kind text,
  ADD COLUMN IF NOT EXISTS hrv_source_name text,
  ADD COLUMN IF NOT EXISTS hrv_source_id text,
  ADD COLUMN IF NOT EXISTS hrv_platform text,
  ADD COLUMN IF NOT EXISTS hrv_device_id text;

COMMENT ON COLUMN public.heart_rate_sessions.hrv_validation_status IS 'Resultado da validação: valid, insufficient, invalid, stale, unsupported, permission_denied ou no_data.';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_validation_reason IS 'Código(s) resumido(s) do motivo da validação da HRV.';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_valid_ratio IS 'Proporção de intervalos RR aceitos entre os intervalos observados.';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_source_kind IS 'Origem normalizada: ble, apple_health ou health_connect.';
