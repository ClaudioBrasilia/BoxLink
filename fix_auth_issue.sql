-- SQL FIX: acesso bloqueado por perfil ausente/inacessível
-- Execute este script no SQL Editor do Supabase

BEGIN;

-- 1) Garantir RLS habilitado na tabela de perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Função de criação automática de perfil no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Novo Atleta'),
    NEW.email,
    CASE WHEN NEW.email = 'claudiobrasilia13@gmail.com' THEN 'admin' ELSE 'athlete' END,
    CASE WHEN NEW.email = 'claudiobrasilia13@gmail.com' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Garantir trigger no auth.users -> public.handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4) Backfill de usuários já existentes no auth sem profile
INSERT INTO public.profiles (id, name, email, role, status)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', 'Atleta'),
  au.email,
  CASE WHEN au.email = 'claudiobrasilia13@gmail.com' THEN 'admin' ELSE 'athlete' END,
  CASE WHEN au.email = 'claudiobrasilia13@gmail.com' THEN 'approved' ELSE 'pending' END
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5) Policies mínimas para o próprio usuário ler/atualizar seu profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

COMMIT;
