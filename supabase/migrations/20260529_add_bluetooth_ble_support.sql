-- Atualizar tabela heart_rate_live para suportar múltiplos dispositivos
ALTER TABLE public.heart_rate_live ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.heart_rate_live ADD COLUMN IF NOT EXISTS device_name TEXT;

-- Criar índices para performance se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_heart_rate_live_device_id' AND n.nspname = 'public') THEN
        CREATE INDEX idx_heart_rate_live_device_id ON public.heart_rate_live(device_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_heart_rate_live_device_name' AND n.nspname = 'public') THEN
        CREATE INDEX idx_heart_rate_live_device_name ON public.heart_rate_live(device_name);
    END IF;
END $$;

-- Atualizar políticas de segurança
DROP POLICY IF EXISTS "Users can insert their own heart rate" ON public.heart_rate_live;
CREATE POLICY "Users can insert their own heart rate" ON public.heart_rate_live 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Habilitar Realtime para a tabela
-- Nota: O comando ALTER PUBLICATION pode falhar se a publicação não existir ou a tabela já estiver lá
-- Por isso usamos um bloco anônimo para tratar possíveis erros
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.heart_rate_live;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Não foi possível adicionar a tabela à publicação: %', SQLERRM;
END $$;
