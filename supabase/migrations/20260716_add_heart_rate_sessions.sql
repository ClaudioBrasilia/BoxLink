-- Histórico de treinos de Frequência Cardíaca (resumo + gráfico completo).
-- Guarda os pontos (samples) para reabrir o gráfico igualzinho depois.

CREATE TABLE IF NOT EXISTS public.heart_rate_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at      timestamptz,
  ended_at        timestamptz DEFAULT now(),
  duration_sec    integer,
  avg_bpm         integer,
  max_bpm         integer,
  min_bpm         integer,
  effort          integer,
  calories        integer,
  calories_source text,            -- 'device' | 'estimate'
  steps           integer,
  zone_secs       jsonb,           -- [reposo, aquec, aer, anaer, max] em segundos
  dominant_zone   integer,
  samples         jsonb,           -- [{ t, bpm }, ...] para o gráfico
  device_name     text,
  source          text,            -- 'ble' | 'health'
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_sessions_user_created
  ON public.heart_rate_sessions (user_id, created_at DESC);

-- RLS: cada atleta gerencia/consulta apenas os próprios treinos.
ALTER TABLE public.heart_rate_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_sessions_select_own" ON public.heart_rate_sessions;
CREATE POLICY "hr_sessions_select_own" ON public.heart_rate_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "hr_sessions_insert_own" ON public.heart_rate_sessions;
CREATE POLICY "hr_sessions_insert_own" ON public.heart_rate_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hr_sessions_delete_own" ON public.heart_rate_sessions;
CREATE POLICY "hr_sessions_delete_own" ON public.heart_rate_sessions
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
