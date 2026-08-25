-- Adiciona HRV/VFC às sessões de frequência cardíaca sem alterar registros antigos.
-- RR é guardado em milissegundos; as métricas são derivadas no cliente a partir
-- dos intervalos válidos e ficam identificadas para não misturar SDNN com RMSSD.

ALTER TABLE public.heart_rate_sessions
  ADD COLUMN IF NOT EXISTS rr_intervals_ms jsonb,
  ADD COLUMN IF NOT EXISTS hrv_rmssd_ms numeric,
  ADD COLUMN IF NOT EXISTS hrv_sdnn_ms numeric,
  ADD COLUMN IF NOT EXISTS hrv_metric text,
  ADD COLUMN IF NOT EXISTS hrv_at timestamptz;

COMMENT ON COLUMN public.heart_rate_sessions.rr_intervals_ms IS
  'Intervalos RR/IBI em milissegundos capturados do canal padrão BLE, quando disponíveis.';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_rmssd_ms IS
  'RMSSD em milissegundos, calculado a partir dos intervalos RR válidos.';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_sdnn_ms IS
  'SDNN em milissegundos, calculado a partir dos intervalos RR válidos ou fornecido pelo app de saúde.';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_metric IS
  'Métrica de HRV exibida: rmssd (Android/BLE calculado) ou sdnn (Apple Health).';
COMMENT ON COLUMN public.heart_rate_sessions.hrv_at IS
  'Instante da amostra de HRV sincronizada pelo app de saúde, quando aplicável.';

NOTIFY pgrst, 'reload schema';
