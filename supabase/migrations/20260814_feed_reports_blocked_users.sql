-- Denúncia e bloqueio de conteúdo/usuários no Feed (exigência de conteúdo gerado
-- por usuário da Play Store: precisa haver como denunciar e bloquear).

create table if not exists public.feed_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.feed_posts(id) on delete cascade,
  comment_id uuid references public.feed_comments(id) on delete cascade,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint feed_reports_target_check check (
    (post_id is not null and comment_id is null) or (post_id is null and comment_id is not null)
  )
);

alter table public.feed_reports enable row level security;

create policy "Users insert own reports"
  on public.feed_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users view own reports"
  on public.feed_reports for select
  using (auth.uid() = reporter_id);

create policy "Admins manage reports"
  on public.feed_reports for all
  using ((select profiles.role from profiles where profiles.id = auth.uid()) = 'admin');

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self check (blocker_id <> blocked_id),
  constraint blocked_users_unique unique (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "Users manage own blocks"
  on public.blocked_users for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);
