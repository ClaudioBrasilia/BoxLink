// src/components/ClanInviteBanner.tsx
// Aviso de convite de time na tela inicial.
//
// O convite chegava só dentro de Times, e o atleta não tinha como saber que
// alguém o havia convidado — daí a sensação de que "convidar não funciona".
// Aqui a pessoa aceita ou recusa direto da home.
//
// Depende das políticas criadas em `supabase/migrations/20261122_clan_invites.sql`:
// antes delas o próprio atleta não podia atualizar nem apagar a sua linha em
// `clan_memberships` (só o capitão podia), e o aceite falhava em silêncio.

import { useEffect, useState } from 'react';
import { Check, X, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface InviteClan {
  id: string;
  name: string;
  motto?: string | null;
  banner?: string | null;
  color?: string | null;
}

interface Invite {
  id: string;
  clan: InviteClan | null;
}

export default function ClanInviteBanner() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user) return;
      const { data, error: loadError } = await supabase
        .from('clan_memberships')
        .select('id, status, clans(id, name, motto, banner, color)')
        .eq('user_id', user.id)
        .eq('status', 'invited');
      if (!alive) return;
      if (loadError) {
        // Sem a migration o embed ainda funciona; só não mostramos nada.
        setInvites([]);
        return;
      }
      const rows = (data || []).map((row: any) => {
        // O embed pode vir como objeto ou array dependendo do cache do schema.
        const clan = Array.isArray(row.clans) ? row.clans[0] : row.clans;
        return { id: row.id as string, clan: (clan as InviteClan) || null };
      });
      setInvites(rows.filter((r) => r.clan));
    };
    load();
    return () => { alive = false; };
  }, [user]);

  const accept = async (invite: Invite) => {
    setBusyId(invite.id);
    setError(null);
    const { error: updateError } = await supabase
      .from('clan_memberships')
      .update({ status: 'approved' })
      .eq('id', invite.id);
    setBusyId(null);
    if (updateError) {
      setError('Não foi possível aceitar agora. Abra a aba Times para tentar de novo.');
      return;
    }
    setInvites((list) => list.filter((i) => i.id !== invite.id));
  };

  const reject = async (invite: Invite) => {
    setBusyId(invite.id);
    setError(null);
    const { error: deleteError } = await supabase
      .from('clan_memberships')
      .delete()
      .eq('id', invite.id);
    setBusyId(null);
    if (deleteError) {
      setError('Não foi possível recusar agora. Abra a aba Times para tentar de novo.');
      return;
    }
    setInvites((list) => list.filter((i) => i.id !== invite.id));
  };

  if (invites.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="rounded-[2rem] border-2 p-4 bg-surface-container-low"
          style={{ borderColor: invite.clan?.color || '#CAFD00' }}
        >
          <p className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5" /> Convite de time
          </p>
          <div className="flex items-center gap-3">
            {invite.clan?.banner ? (
              <img
                src={invite.clan.banner}
                alt={invite.clan.name}
                className="w-11 h-11 rounded-2xl object-cover border border-outline-variant/20"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-headline font-black text-on-surface text-base uppercase italic truncate">
                {invite.clan?.name}
              </p>
              <p className="text-[10px] text-on-surface-variant font-bold truncate">
                {invite.clan?.motto ? `"${invite.clan.motto}"` : 'Você foi convidado para este time'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => accept(invite)}
              disabled={busyId === invite.id}
              className="flex-1 py-2.5 rounded-xl bg-primary text-background font-headline font-black text-[11px] uppercase italic flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Aceitar
            </button>
            <button
              onClick={() => reject(invite)}
              disabled={busyId === invite.id}
              className="flex-1 py-2.5 rounded-xl bg-surface-container-highest text-on-surface-variant border border-outline-variant/20 font-headline font-black text-[11px] uppercase italic flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Recusar
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-[10px] text-error font-bold">{error}</p>}
    </div>
  );
}
