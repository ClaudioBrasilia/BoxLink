-- Log de tudo que chega no webhook do Wellhub.
--
-- Existe por um motivo concreto: ninguém do time tem acesso ao Partner Portal
-- do Wellhub, então o formato real do payload e o token que ele envia são
-- desconhecidos — a função só podia adivinhar os nomes dos campos. Pior, ela
-- respondia 200 e descartava em silêncio o que não reconhecia, então qualquer
-- erro ficava invisível. Com este log, a primeira chamada real revela as duas
-- coisas de uma vez.

create table if not exists public.wellhub_webhook_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  method text,
  headers jsonb,
  payload jsonb,
  -- Mascarado quando a autenticação passa; em claro só quando ela falha, que
  -- é justamente o caso em que precisamos descobrir o token do parceiro.
  api_key_received text,
  outcome text,
  detail text
);

create index if not exists wellhub_webhook_log_received_idx
  on public.wellhub_webhook_log (received_at desc);

alter table public.wellhub_webhook_log enable row level security;

-- A função grava com a service_role, que ignora RLS — por isso não há policy
-- de insert. Leitura é só de admin, já que o log pode conter credencial.
do $$ begin
  create policy "Admins can view wellhub webhook log"
    on public.wellhub_webhook_log for select
    using ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can clear wellhub webhook log"
    on public.wellhub_webhook_log for delete
    using ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;
