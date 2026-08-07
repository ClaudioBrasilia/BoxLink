-- clan_memberships.user_id only ever referenced auth.users, so PostgREST knew
-- no relationship between clan_memberships and public.profiles. Every embedded
-- read in Clans.tsx that asks for profiles through a membership therefore
-- failed -- the team detail modal ("MEMBROS 0" while the ranking card next to
-- it correctly showed 1/2) and the captain's pending-request list, which both
-- swallowed the error and rendered an empty list.
--
-- Add the missing foreign key to public.profiles so the embeds resolve. The
-- existing auth.users key stays: profiles is 1:1 with auth.users, and both
-- cascade on delete. Verified beforehand that no membership row points at a
-- missing profile.

alter table public.clan_memberships
  add constraint clan_memberships_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
