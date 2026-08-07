-- clan_memberships carried UNIQUE (user_id), meaning an athlete could only
-- ever have ONE membership row in the whole system. Clans.tsx is built on the
-- opposite assumption -- an athlete may hold an invite from team B while still
-- being approved in team A, and may receive invites from several teams at once
-- ("Busca TODAS as linhas de membership do user"). With the old constraint,
-- inviting anyone who already had any row failed with a duplicate key error.
--
-- Move to UNIQUE (clan_id, user_id), which is what supabase_schema.sql already
-- declared: one row per athlete per team, several teams allowed.
--
-- The "one team at a time" rule is NOT enforced here on purpose: it is governed
-- by box_settings.allow_multiple_clans_per_user, an admin toggle, so a hard
-- constraint would break the feature the moment an admin turns it on. The app
-- enforces it when joining a clan and when accepting an invite.

alter table public.clan_memberships
  drop constraint if exists clan_memberships_user_id_key;

alter table public.clan_memberships
  add constraint clan_memberships_clan_id_user_id_key unique (clan_id, user_id);

-- The dropped unique constraint was also backing the by-user lookups the app
-- runs on every load; keep a plain index so those stay fast.
create index if not exists clan_memberships_user_id_idx
  on public.clan_memberships (user_id);
