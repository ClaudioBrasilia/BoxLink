-- SQL Schema for CrossCity Hub

-- 1. User Profiles (Extends Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text default 'athlete' check (role in ('athlete', 'coach', 'admin')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  level integer default 1,
  xp integer default 0,
  coins integer default 0, -- Initial coins
  avatar_equipped jsonb default '{
    "base_outfit": "default_base",
    "top": null,
    "bottom": null,
    "shoes": null,
    "accessory": null,
    "head_accessory": null,
    "wrist_accessory": null,
    "special": null
  }',
  avatar_inventory text[] default array['default_base'],
  paid_bonuses text[] default array[]::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Economy Settings
create table public.avatar_economy_settings (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  xp_per_checkin integer not null default 20,
  coins_per_checkin integer not null default 5,
  weekly_bonus_3_xp integer not null default 20,
  weekly_bonus_3_coins integer not null default 15,
  weekly_bonus_4_xp integer not null default 30,
  weekly_bonus_4_coins integer not null default 20,
  weekly_bonus_5_xp integer not null default 40,
  weekly_bonus_5_coins integer not null default 30,
  weekly_bonus_6_xp integer not null default 50,
  weekly_bonus_6_coins integer not null default 40,
  level_up_bonus_coins integer not null default 25,
  duel_win_xp integer not null default 40,
  duel_win_coins integer not null default 10,
  duel_loss_xp integer not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Check-ins
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  timestamp timestamptz default now(),
  class_time text,
  created_at timestamptz default now()
);

-- 4. Reward History
create table public.reward_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  xp integer default 0,
  coins integer default 0,
  description text,
  created_at timestamptz default now()
);

-- 5. WODs
create table public.wods (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  type text,
  warmup text,
  skill text,
  rx text,
  scaled text,
  beginner text,
  created_at timestamptz default now()
);

-- 6. Challenges
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  active boolean default true,
  start_date date,
  end_date date,
  xp integer default 0,
  coins integer default 0,
  repeatable boolean default false,
  daily_limit integer default 0,
  difficulty text,
  created_at timestamptz default now()
);

-- 7. Duels
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid references auth.users(id),
  opponent_id uuid references auth.users(id),
  status text default 'active',
  winner_id uuid references auth.users(id),
  reward_xp integer default 0,
  reward_coins integer default 0,
  type text,
  created_at timestamptz default now()
);

-- 8. Schedule
create table public.schedule (
  id uuid primary key default gen_random_uuid(),
  time text not null,
  end_time text,
  coach text,
  capacity integer default 20,
  days integer[] default array[1,2,3,4,5], -- Mon-Fri by default
  is_active boolean default true,
  checkin_window_minutes integer default 60,
  created_at timestamptz default now()
);

-- 9. Items (Shop)
create table public.items (
  id text primary key,
  name text not null,
  slot text not null,
  price integer not null,
  image text,
  created_at timestamptz default now()
);

-- 10. WOD Results
create table public.wod_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  wod_id uuid references public.wods(id) on delete cascade,
  result text not null,
  type text, -- rx, scaled, beginner
  created_at timestamptz default now()
);

-- 11. Personal Records
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  exercise text not null,
  value text not null,
  date date default current_date,
  created_at timestamptz default now()
);

-- 12. Box Settings
create table public.box_settings (
  id uuid primary key default gen_random_uuid(),
  name text default 'CrossCity Hub',
  logo text,
  description text,
  institutional_photo text,
  top_banner text,
  lat double precision default -23.5505,
  lng double precision default -46.6333,
  radius integer default 500,
  clans_enabled boolean default false,
  tv_layout text default 'new',
  tv_config jsonb default '{
    "showCheckins": true,
    "showRanking": true,
    "showDuels": true,
    "showChallenges": true,
    "rightBlockContent": "ranking",
    "topBlockContent": "logo"
  }',
  timezone text default 'America/Sao_Paulo',
  modules jsonb default '{
    "economy": true,
    "store": true,
    "duels": true,
    "challenges": true
  }',
  is_active boolean default true,
  updated_at timestamptz default now()
);

-- 13. Clans
create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  motto text,
  color text default '#CAFD00',
  created_by uuid references auth.users(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 14. Clan Memberships
create table public.clan_memberships (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid references public.clans(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('member', 'captain')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  unique(clan_id, user_id)
);

-- 15. Territories
create table public.territories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  focus text,
  rotation_order integer,
  created_at timestamptz default now()
);

-- 16. Domination Events
create table public.domination_events (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid references public.clans(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  territory_id uuid references public.territories(id) on delete cascade,
  energy integer default 0,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.reward_history enable row level security;
alter table public.wod_results enable row level security;
alter table public.personal_records enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view their own checkins" on public.checkins for select using (auth.uid() = user_id);
create policy "Users can insert their own checkins" on public.checkins for insert with check (auth.uid() = user_id);

create policy "Users can view their own rewards" on public.reward_history for select using (auth.uid() = user_id);

create policy "WOD results are viewable by everyone" on public.wod_results for select using (true);
create policy "Users can insert their own WOD results" on public.wod_results for insert with check (auth.uid() = user_id);

create policy "Users can view their own PRs" on public.personal_records for select using (auth.uid() = user_id);
create policy "Users can manage their own PRs" on public.personal_records for all using (auth.uid() = user_id);

-- Clans Policies
create policy "Clans are viewable by everyone" on public.clans for select using (true);
create policy "Captains can manage their clans" on public.clans for all using (
  exists (
    select 1 from public.clan_memberships
    where clan_id = id and user_id = auth.uid() and role = 'captain'
  )
);
create policy "Users can create clans" on public.clans for insert with check (auth.role() = 'authenticated');

create policy "Memberships are viewable by everyone" on public.clan_memberships for select using (true);
create policy "Users can apply for membership" on public.clan_memberships for insert with check (auth.uid() = user_id);
create policy "Captains can manage memberships" on public.clan_memberships for all using (
  exists (
    select 1 from public.clan_memberships
    where clan_id = public.clan_memberships.clan_id and user_id = auth.uid() and role = 'captain'
  )
);

create policy "Territories are viewable by everyone" on public.territories for select using (true);

create policy "Domination events are viewable by everyone" on public.domination_events for select using (true);
create policy "Users can insert domination events" on public.domination_events for insert with check (auth.uid() = user_id);

-- Functions and Triggers
-- Automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Atleta'), 
    new.email,
    CASE WHEN new.email = 'claudiobrasilia13@gmail.com' THEN 'admin' ELSE 'athlete' END,
    CASE WHEN new.email = 'claudiobrasilia13@gmail.com' THEN 'approved' ELSE 'pending' END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill script for existing users without profiles
INSERT INTO public.profiles (id, name, email, role, status)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'name', 'Atleta'), 
    email,
    CASE WHEN email = 'claudiobrasilia13@gmail.com' THEN 'admin' ELSE 'athlete' END,
    CASE WHEN email = 'claudiobrasilia13@gmail.com' THEN 'approved' ELSE 'pending' END
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
