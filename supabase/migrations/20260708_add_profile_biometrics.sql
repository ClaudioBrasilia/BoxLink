-- Biometria do atleta para métricas de treino (calorias, % da FC máxima).
-- Todas as colunas são NULLABLE — nenhum perfil existente é afetado.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg  numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm  numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sex        text;

-- Restringe 'sex' a valores válidos (permitindo NULL). Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_sex_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_sex_check CHECK (sex IS NULL OR sex IN ('male', 'female'));
  END IF;
END $$;
