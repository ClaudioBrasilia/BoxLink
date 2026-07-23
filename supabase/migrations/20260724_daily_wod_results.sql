-- ─────────────────────────────────────────────────────────────────────────────
-- WOD do Dia — placar comunitário dos atletas individuais
-- Um WOD por dia (rotação de benchmarks definida no app). Cada atleta posta o
-- seu resultado e vê o ranking de todo mundo que fez o mesmo WOD.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.daily_wod_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wod_date date not null,
  wod_name text not null,
  wod_type text not null,
  result text not null,
  scaling text not null default 'rx' check (scaling in ('rx', 'scaled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, wod_date)
);

create index if not exists daily_wod_results_date_idx
  on public.daily_wod_results (wod_date, created_at);

alter table public.daily_wod_results enable row level security;

-- Placar é público (todos veem o ranking do dia)
do $$ begin
  create policy "Daily WOD results are viewable by everyone"
    on public.daily_wod_results for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own daily WOD result"
    on public.daily_wod_results for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own daily WOD result"
    on public.daily_wod_results for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own daily WOD result"
    on public.daily_wod_results for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
