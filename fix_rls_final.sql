BEGIN;

-- Remove políticas conflitantes
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Uma única policy de SELECT: autenticados veem todos os perfis (necessário para leaderboard/duels)
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);

-- Policy de UPDATE: só o próprio usuário
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Garante que seu usuário admin está correto
UPDATE public.profiles
SET role = 'admin', status = 'approved'
WHERE email = 'claudiobrasilia13@gmail.com';

COMMIT;
