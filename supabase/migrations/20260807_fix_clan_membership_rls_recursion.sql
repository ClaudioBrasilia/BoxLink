-- Fix "infinite recursion detected in policy for relation clan_memberships".
--
-- The captain policy added in 20260807_clan_captain_membership_policies.sql
-- queried clan_memberships from inside its own USING/WITH CHECK clause.
-- Postgres re-evaluates RLS on that inner query, so every statement against
-- the table failed outright -- which is why every team's member list, XP
-- totals and "meu time" card went empty in the app.
--
-- Moving the captain check into a SECURITY DEFINER function breaks the cycle:
-- the function runs with the owner's privileges and does not re-trigger RLS
-- on the inner lookup. This is the standard Supabase pattern for
-- self-referencing RLS checks.

drop policy if exists "Captains can manage their clan memberships" on public.clan_memberships;

create or replace function public.is_approved_clan_captain(p_clan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clan_memberships
    where clan_id = p_clan_id
      and user_id = auth.uid()
      and role = 'captain'
      and status = 'approved'
  );
$$;

revoke all on function public.is_approved_clan_captain(uuid) from public;
grant execute on function public.is_approved_clan_captain(uuid) to authenticated;

create policy "Captains can manage their clan memberships"
on public.clan_memberships
for all
using (public.is_approved_clan_captain(clan_id))
with check (public.is_approved_clan_captain(clan_id));
