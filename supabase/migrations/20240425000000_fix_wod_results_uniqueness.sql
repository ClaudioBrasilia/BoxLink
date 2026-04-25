-- Migração: Garantir unicidade no registro de WOD e habilitar Realtime
-- 1. Deduplicar wod_results mantendo o registro mais recente por (user_id, wod_id)
DELETE FROM public.wod_results a USING public.wod_results b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND a.wod_id = b.wod_id;

-- 2. Criar índice único (ou constraint) para evitar duplicatas futuras
-- Usando DROP + CREATE para garantir que o estado final seja o desejado
ALTER TABLE public.wod_results DROP CONSTRAINT IF EXISTS unique_user_wod;
ALTER TABLE public.wod_results ADD CONSTRAINT unique_user_wod UNIQUE (user_id, wod_id);

-- 3. Habilitar Realtime para a tabela wod_results se ainda não estiver
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'wod_results'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wod_results;
    END IF;
END $$;

-- 4. Garantir que as políticas de RLS permitem UPSERT (necessário para a Edge Function ou se o frontend mudar)
DROP POLICY IF EXISTS "Users can insert their own WOD results" ON public.wod_results;
DROP POLICY IF EXISTS "Users can update their own WOD results" ON public.wod_results;

CREATE POLICY "Users can insert their own WOD results" ON public.wod_results 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WOD results" ON public.wod_results 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
