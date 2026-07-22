-- [ignoring loop detection]
-- SQL FIX: Perfil Não Encontrado (BoxLink)
-- Execute este script no SQL Editor do Supabase

-- 1. Atualizar/Criar a função de automação
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Atleta'),
    new.email,
    'athlete',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir que o Trigger existe e está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Backfill: Sincronizar usuários órfãos (que estão no auth.users mas não no public.profiles)
INSERT INTO public.profiles (id, name, email, role, status)
SELECT
    id,
    COALESCE(raw_user_meta_data->>'name', 'Atleta'),
    email,
    'athlete',
    'pending'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Promover o administrador do box. Rode UMA VEZ trocando pelo seu e-mail
--    (mantenha seu e-mail fora do código versionado):
-- UPDATE public.profiles
-- SET role = 'admin', status = 'approved'
-- WHERE email = 'SEU-EMAIL@AQUI.com';
