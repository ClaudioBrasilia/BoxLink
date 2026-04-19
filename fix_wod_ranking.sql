-- 1. Adicionar restrição de unicidade para (user_id, wod_id)
-- Isso garante que cada usuário tenha apenas um registro por WOD.
DELETE FROM public.wod_results a USING public.wod_results b
WHERE a.id < b.id AND a.user_id = b.user_id AND a.wod_id = b.wod_id;

-- Tenta adicionar a constraint se ela não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_wod') THEN
        ALTER TABLE public.wod_results ADD CONSTRAINT unique_user_wod UNIQUE (user_id, wod_id);
    END IF;
END $$;

-- 2. Habilitar Realtime para a tabela wod_results
-- (Isso geralmente é feito no dashboard do Supabase, mas o comando SQL abaixo é o padrão)
-- Se já estiver na publicação, não faz nada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'wod_results') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wod_results;
    END IF;
END $$;

-- 3. Corrigir Políticas de RLS para permitir UPSERT (INSERT + UPDATE)
-- Remove as políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can insert their own WOD results" ON public.wod_results;
DROP POLICY IF EXISTS "Users can update their own WOD results" ON public.wod_results;
DROP POLICY IF EXISTS "Users can delete their own WOD results" ON public.wod_results;

-- Cria as novas políticas
CREATE POLICY "Users can insert their own WOD results" ON public.wod_results 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WOD results" ON public.wod_results 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WOD results" ON public.wod_results 
FOR DELETE USING (auth.uid() = user_id);
