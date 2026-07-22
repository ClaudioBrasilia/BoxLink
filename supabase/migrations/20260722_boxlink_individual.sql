-- ─────────────────────────────────────────────────────────────────────────────
-- BoxLink Individual (Modo Solo)
-- O atleta sem box registra seus próprios treinos (diário), faz check-in solo,
-- ganha pontos e duela com amigos através de um código de amigo.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Tipo de conta e código de amigo no perfil
alter table public.profiles
  add column if not exists account_type text not null default 'box';

do $$ begin
  alter table public.profiles
    add constraint profiles_account_type_check
    check (account_type in ('box', 'individual'));
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists friend_code text;

do $$ begin
  alter table public.profiles
    add constraint profiles_friend_code_key unique (friend_code);
exception when duplicate_object then null; end $$;

-- 2) Gerador de código de amigo (formato XXXX-XXXX, sem caracteres ambíguos)
create or replace function public.generate_friend_code()
returns text as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  tries int := 0;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    code := substr(code, 1, 4) || '-' || substr(code, 5, 4);
    exit when not exists (select 1 from public.profiles where friend_code = code);
    tries := tries + 1;
    exit when tries > 50;
  end loop;
  return code;
end;
$$ language plpgsql volatile;

-- Backfill: todo perfil existente ganha um código
update public.profiles
set friend_code = public.generate_friend_code()
where friend_code is null;

-- Novos perfis recebem o código automaticamente
create or replace function public.set_friend_code()
returns trigger as $$
begin
  if new.friend_code is null then
    new.friend_code := public.generate_friend_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_friend_code on public.profiles;
create trigger trg_set_friend_code
  before insert on public.profiles
  for each row execute procedure public.set_friend_code();

-- 3) Cadastro individual: auto-aprovado (não depende de admin de box)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_account_type text := COALESCE(new.raw_user_meta_data->>'account_type', 'box');
BEGIN
  IF v_account_type NOT IN ('box', 'individual') THEN
    v_account_type := 'box';
  END IF;

  INSERT INTO public.profiles (id, name, email, role, status, account_type)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Atleta'),
    new.email,
    'athlete',
    -- Conta individual entra liberada; aluno de box aguarda aprovação do admin.
    -- Admin é atribuído manualmente (SQL) ou por outro admin no painel — nunca no cadastro.
    CASE WHEN v_account_type = 'individual' THEN 'approved' ELSE 'pending' END,
    v_account_type
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Diário de treino (log pessoal: WOD, força/carga máxima, desafio, nota)
create table if not exists public.training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  title text not null,
  category text not null default 'wod' check (category in ('wod', 'forca', 'desafio', 'nota')),
  wod_type text,                -- FOR TIME, AMRAP, EMOM, TABATA, OUTRO
  description text,             -- movimentos / detalhes do treino
  result text,                  -- tempo, reps ou rounds
  exercise text,                -- exercício (categoria força) — vinculado ao PR
  load_kg numeric,              -- carga levantada (categoria força)
  rpe integer check (rpe is null or rpe between 1 and 10),
  feeling text check (feeling is null or feeling in ('otimo', 'bem', 'normal', 'cansado', 'dor')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists training_logs_user_date_idx
  on public.training_logs (user_id, date desc);

alter table public.training_logs enable row level security;

do $$ begin
  create policy "Users can view their own training logs"
    on public.training_logs for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own training logs"
    on public.training_logs for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own training logs"
    on public.training_logs for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own training logs"
    on public.training_logs for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 5) Pedidos de entrada no box (atleta individual → aluno do box)
create table if not exists public.box_join_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists box_join_requests_user_idx
  on public.box_join_requests (user_id, created_at desc);

alter table public.box_join_requests enable row level security;

do $$ begin
  create policy "Users can view their own join requests"
    on public.box_join_requests for select
    using (auth.uid() = user_id or (select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can create their own join requests"
    on public.box_join_requests for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can manage join requests"
    on public.box_join_requests for update
    using ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can cancel their own pending join requests"
    on public.box_join_requests for delete
    using (auth.uid() = user_id and status = 'pending');
exception when duplicate_object then null; end $$;
