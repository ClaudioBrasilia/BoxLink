-- ─────────────────────────────────────────────────────────────────────────────
-- Plano do atleta (base para recursos premium do BoxLink Individual)
-- 'free'    = grátis (limites aplicados no app)
-- 'premium' = pago (duelo com vários amigos, liga/ranking, histórico ilimitado,
--             código de atleta personalizado, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists plan text not null default 'free';

do $$ begin
  alter table public.profiles
    add constraint profiles_plan_check
    check (plan in ('free', 'premium'));
exception when duplicate_object then null; end $$;

-- Validade opcional da assinatura (null = sem expiração / vitalício / grátis)
alter table public.profiles
  add column if not exists plan_expires_at timestamptz;
