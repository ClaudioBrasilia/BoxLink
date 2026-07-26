-- Concessão manual de Premium (antes de existir um gateway de pagamento
-- real): plan_grants é o histórico de quem concedeu, quando, validade e
-- valor cobrado — serve de registro de vendas manuais (PIX, dinheiro etc.)
-- e de base para plugar um pagamento automático depois sem perder esse
-- histórico.

create table if not exists public.plan_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id),
  plan text not null check (plan in ('free', 'premium')),
  method text not null default 'manual',
  price_cents integer,
  note text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists plan_grants_user_idx
  on public.plan_grants (user_id, created_at desc);

alter table public.plan_grants enable row level security;

do $$ begin
  create policy "Users can view their own plan grants"
    on public.plan_grants for select
    using (auth.uid() = user_id or (select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can create plan grants"
    on public.plan_grants for insert
    with check ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

-- Preço e contato exibidos nas telas de "Quero ser Premium" (configurável
-- pelo admin, sem precisar mexer em código).
alter table public.box_settings
  add column if not exists premium_info jsonb not null default '{"price_cents": 1990, "contact": ""}'::jsonb;
