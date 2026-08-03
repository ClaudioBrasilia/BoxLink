-- Lista de amigos de duelo (individual): quem já duelou com você fica salvo
-- pra busca rápida no próximo duelo, sem digitar o código de novo. Mútua —
-- aparece na lista dos dois lados — mas só quem a criou grava a linha (evita
-- o problema de RLS de inserir "pela outra pessoa"); a leitura considera
-- os dois lados (user_id ou friend_id) como "meu amigo".

create table if not exists public.duel_friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);

create index if not exists duel_friends_user_idx on public.duel_friends (user_id);
create index if not exists duel_friends_friend_idx on public.duel_friends (friend_id);

alter table public.duel_friends enable row level security;

do $$ begin
  create policy "Users can view their own friend connections"
    on public.duel_friends for select
    using (auth.uid() = user_id or auth.uid() = friend_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can create their own friend connections"
    on public.duel_friends for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own friend connections"
    on public.duel_friends for delete
    using (auth.uid() = user_id or auth.uid() = friend_id);
exception when duplicate_object then null; end $$;
