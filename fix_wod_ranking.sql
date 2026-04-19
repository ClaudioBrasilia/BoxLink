-- 1. Adicionar restrição de unicidade para (user_id, wod_id)
-- Isso garante que cada usuário tenha apenas um registro por WOD.
-- Se houver duplicatas, o comando abaixo pode falhar. O ideal é limpar antes.
DELETE FROM public.wod_results a USING public.wod_results b
WHERE a.id < b.id AND a.user_id = b.user_id AND a.wod_id = b.wod_id;

ALTER TABLE public.wod_results ADD CONSTRAINT unique_user_wod UNIQUE (user_id, wod_id);

-- 2. Habilitar Realtime para a tabela wod_results
-- (Isso geralmente é feito no dashboard do Supabase, mas o comando SQL abaixo é o padrão)
alter publication supabase_realtime add table public.wod_results;
