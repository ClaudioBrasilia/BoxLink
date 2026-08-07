-- Fix "Erro ao enviar convite: new row violates row-level security policy
-- for table clan_memberships" and other broken team-formation flows.
--
-- clan_memberships only had RLS policies for: self-insert (join a clan),
-- self-or-admin update, and admin-only all-access. There was no policy
-- letting a clan captain insert/update/delete membership rows for OTHER
-- users in their own clan, so captains could not send invites, approve or
-- reject join requests, or remove members. There was also no policy
-- letting a user delete their own membership row (leave a clan / decline
-- an invite).

create policy "Captains can manage their clan memberships"
on public.clan_memberships
for all
using (
  exists (
    select 1 from public.clan_memberships cm
    where cm.clan_id = clan_memberships.clan_id
      and cm.user_id = auth.uid()
      and cm.role = 'captain'
      and cm.status = 'approved'
  )
)
with check (
  exists (
    select 1 from public.clan_memberships cm
    where cm.clan_id = clan_memberships.clan_id
      and cm.user_id = auth.uid()
      and cm.role = 'captain'
      and cm.status = 'approved'
  )
);

create policy "Users can delete their own membership"
on public.clan_memberships
for delete
using (auth.uid() = user_id);
