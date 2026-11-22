-- ─────────────────────────────────────────────────────────────────────────────
-- Convites de time: busca sem acento, código/link de convite e RLS do atleta
--
-- Três assuntos, todos do fluxo de convite de time:
--  1. busca tolerante (sem acento) para o capitão achar o atleta;
--  2. código de convite do time, para o atleta entrar sozinho;
--  3. políticas que faltavam: sem elas o atleta NÃO consegue aceitar o convite,
--     recusar o convite nem sair do time (o app chamava update/delete e o
--     Postgres recusava em silêncio).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Busca tolerante ─────────────────────────────────────────────────────────
-- `ilike` no Postgres não ignora acento: "joao" não encontra "João". A busca do
-- app compara o termo digitado com uma coluna já normalizada.
create or replace function public.search_normalize(value text)
returns text
language sql
immutable
as $$
  select lower(translate(
    coalesce(value, ''),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY'
  ));
$$;

-- Coluna gerada (e não trigger) para o PostgREST conseguir filtrar por ela.
alter table public.profiles
  add column if not exists search_name text
  generated always as (public.search_normalize(name)) stored;

-- 2. Código de convite do time ───────────────────────────────────────────────
alter table public.clans
  add column if not exists invite_code text;

-- Times que já existem ganham um código agora (6 caracteres, ex.: "A1B2C3").
update public.clans
   set invite_code = upper(substr(md5(random()::text || id::text), 1, 6))
 where invite_code is null;

-- Times novos ganham o código sozinhos, mesmo vindo de uma versão antiga do app.
alter table public.clans
  alter column invite_code set default upper(substr(md5(random()::text), 1, 6));

alter table public.clans
  alter column invite_code set not null;

create unique index if not exists clans_invite_code_key
  on public.clans (invite_code);

-- 3. O atleta responde ao próprio convite ────────────────────────────────────
-- Aceitar (update) e recusar (delete) eram bloqueados: só capitão tinha
-- política. A regra abaixo libera apenas a linha do próprio atleta, e só
-- enquanto ela está 'invited' — não dá para virar capitão pelo caminho.
do $$ begin
  create policy "Users can answer their own invite"
    on public.clan_memberships for update
    using (auth.uid() = user_id and status = 'invited')
    with check (auth.uid() = user_id and role = 'member' and status in ('approved', 'rejected'));
exception when duplicate_object then null; end $$;

-- Recusar convite, cancelar a própria solicitação, sair do time e refazer a
-- solicitação depois de recusado: todos são um delete da PRÓPRIA linha.
do $$ begin
  create policy "Users can drop their own membership"
    on public.clan_memberships for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
