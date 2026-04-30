import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Swords, Plus, Crown, LogIn, Zap, Trophy, X, Check, Sparkles, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DominationEnergyButton } from '../components/DominationEnergyButton';

interface Clan {
  id: string;
  name: string;
  motto: string;
  color: string;
  banner?: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

interface ClanMembership {
  id: string;
  clan_id: string;
  user_id: string;
  role: 'member' | 'captain';
  status: 'pending' | 'approved' | 'rejected' | 'invited';
}

interface Territory {
  id: string;
  name: string;
  icon: string;
  focus: string;
  rotation_order: number;
}

interface DominationEvent {
  clan_id: string;
  energy: number;
}

// Team rewards — economia de time (inspirado no crosscity-hub)
const teamRewards = [
  {
    id: 'reward_surprise',
    title: 'Brinde Surpresa',
    description: 'Item exclusivo para o time que dominar o território. Revelado no final do mês!',
    type: 'real',
    icon: '🎁',
  },
  {
    id: 'reward_badges',
    title: 'Badges de Honra',
    description: 'Medalha digital para guerreiros de consistência e presença.',
    type: 'digital',
    icon: '🏅',
  },
  {
    id: 'reward_xp',
    title: 'Bônus de XP — Sábados',
    description: 'Multiplicador de XP para quem treinar no sábado, o dia mais desafiador!',
    type: 'power',
    icon: '⚡',
  },
];

const BANNER_OPTIONS = ['🛡️', '⚔️', '🔥', '💪', '🦅', '🐺', '🏆', '⚡', '🌪️', '🗡️'];

export default function Clans() {
  const { user } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [memberships, setMemberships] = useState<ClanMembership[]>([]);
  const [dominationEvents, setDominationEvents] = useState<DominationEvent[]>([]);
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [myMembership, setMyMembership] = useState<ClanMembership | null>(null);
  const [clansEnabled, setClansEnabled] = useState(false);
  const [maxClanMembers, setMaxClanMembers] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClanDetailModal, setShowClanDetailModal] = useState<Clan | null>(null);
  const [clanMembers, setClanMembers] = useState<{ id: string; name: string; role: string; xp: number; membershipId: string }[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(ClanMembership & { profiles: { name: string } })[]>([]);
  const [invitations, setInvitations] = useState<(ClanMembership & { clans: Clan })[]>([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [foundAthletes, setFoundAthletes] = useState<{ id: string; name: string }[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanMotto, setNewClanMotto] = useState('');
  const [newClanColor, setNewClanColor] = useState('#CAFD00');
  const [newClanBanner, setNewClanBanner] = useState('🛡️');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const colors = ['#CAFD00', '#FF4444', '#4444FF', '#FF8800', '#AA44FF', '#00CCFF', '#FF44AA'];
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchAll();
  }, [tick]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('box_settings')
        .select('clans_enabled, max_clan_members')
        .maybeSingle();
      setClansEnabled(settings?.clans_enabled || false);
      setMaxClanMembers(settings?.max_clan_members || 10);

      const { data: clansData } = await supabase
        .from('clans')
        .select('*')
        .eq('is_active', true)
        .order('created_at');
      setClans(clansData || []);

      const { data: membershipsData } = await supabase.from('clan_memberships').select('*');
      setMemberships(membershipsData || []);

      const { data: eventsData } = await supabase
        .from('domination_events')
        .select('clan_id, energy')
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');
      setDominationEvents(eventsData || []);

      const { data: territoriesData } = await supabase
        .from('territories')
        .select('*')
        .order('rotation_order');
      if (territoriesData && territoriesData.length > 0) {
        const dayOfYear = Math.floor(
          (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
        );
        setTerritory(territoriesData[dayOfYear % territoriesData.length]);
      }

      if (user) {
        const { data: myMembershipData } = await supabase
          .from('clan_memberships')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        setMyMembership(myMembershipData);

        if (myMembershipData) {
          const myClanData = (clansData || []).find((c) => c.id === myMembershipData.clan_id) || null;
          setMyClan(myClanData);

          if (myMembershipData.status === 'approved' && myMembershipData.role === 'captain') {
            const { data: pending } = await supabase
              .from('clan_memberships')
              .select('*, profiles(name)')
              .eq('clan_id', myMembershipData.clan_id)
              .eq('status', 'pending');
            setPendingRequests((pending as any) || []);
          } else {
            setPendingRequests([]);
          }

          if (myMembershipData.status === 'invited') {
            const { data: inviteData } = await supabase
              .from('clan_memberships')
              .select('*, clans(*)')
              .eq('id', myMembershipData.id)
              .single();
            setInvitations(inviteData ? [inviteData as any] : []);
          } else {
            setInvitations([]);
          }
        } else {
          setMyClan(null);
          setPendingRequests([]);
          setInvitations([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const searchAthletes = async (query: string) => {
    if (query.trim().length < 3) { setFoundAthletes([]); return; }
    setLoadingSearch(true);
    try {
      const { data: allMemberships } = await supabase.from('clan_memberships').select('user_id');
      const memberIds = (allMemberships || []).map((m) => m.user_id);
      const { data: athletes } = await supabase
        .from('profiles')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .not('id', 'in', `(${memberIds.length > 0 ? memberIds.join(',') : '""'})`)
        .limit(5);
      setFoundAthletes(athletes || []);
    } finally {
      setLoadingSearch(false);
    }
  };

  const sendInvite = async (athleteId: string) => {
    if (!myClan) return;
    const { error } = await supabase.from('clan_memberships').insert({
      clan_id: myClan.id, user_id: athleteId, role: 'member', status: 'invited',
    });
    if (!error) {
      alert('Convite enviado!');
      setAthleteSearch('');
      setFoundAthletes([]);
    } else {
      alert('Erro ao enviar convite: ' + error.message);
    }
  };

  const fetchClanMembers = async (clanId: string) => {
    const { data } = await supabase
      .from('clan_memberships')
      .select('id, user_id, role, profiles(id, name, xp)')
      .eq('clan_id', clanId)
      .eq('status', 'approved');
    if (data) {
      setClanMembers(data.map((m: any) => ({
        id: m.profiles.id,
        name: m.profiles.name,
        role: m.role,
        xp: m.profiles.xp,
        membershipId: m.id,
      })));
    }
  };

  const handleApproveMember = async (requestId: string) => {
    const { error } = await supabase
      .from('clan_memberships').update({ status: 'approved' }).eq('id', requestId);
    if (!error) setTick((v) => v + 1);
  };

  const handleRejectMember = async (requestId: string) => {
    const { error } = await supabase.from('clan_memberships').delete().eq('id', requestId);
    if (!error) setTick((v) => v + 1);
  };

  // Capitão remove membro aprovado
  const handleRemoveApprovedMember = async (membershipId: string) => {
    if (!confirm('Remover este membro do time?')) return;
    const { error } = await supabase.from('clan_memberships').delete().eq('id', membershipId);
    if (!error) {
      await fetchClanMembers(showClanDetailModal!.id);
      setTick((v) => v + 1);
    } else {
      alert('Erro ao remover membro: ' + error.message);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('clan_memberships').update({ status: 'approved' }).eq('id', inviteId);
    if (!error) setTick((v) => v + 1);
  };

  const handleRejectInvite = async (inviteId: string) => {
    const { error } = await supabase.from('clan_memberships').delete().eq('id', inviteId);
    if (!error) setTick((v) => v + 1);
  };

  const leaderboard = useMemo(() => {
    return clans.map((clan) => {
      const members = memberships.filter((m) => m.clan_id === clan.id && m.status === 'approved');
      const energy = dominationEvents.filter((e) => e.clan_id === clan.id).reduce((sum, e) => sum + e.energy, 0);
      return { clan, memberCount: members.length, energy };
    }).sort((a, b) => b.energy - a.energy);
  }, [clans, memberships, dominationEvents]);

  const maxEnergy = Math.max(...leaderboard.map((i) => i.energy), 1);

  const handleCreateClan = async () => {
    if (!newClanName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: clan, error } = await supabase
        .from('clans')
        .insert({ name: newClanName.trim(), motto: newClanMotto.trim(), color: newClanColor, banner: newClanBanner, created_by: user.id })
        .select().single();
      if (error) { alert('Erro ao criar time: ' + error.message); return; }
      await supabase.from('clan_memberships').insert({ clan_id: clan.id, user_id: user.id, role: 'captain', status: 'approved' });
      setShowCreateModal(false);
      setNewClanName('');
      setNewClanMotto('');
      setNewClanBanner('🛡️');
      setTick((v) => v + 1);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    if (!user) return;

    // Verifica limite de membros
    const approvedCount = memberships.filter(m => m.clan_id === clanId && m.status === 'approved').length;
    if (approvedCount >= maxClanMembers) {
      alert(`Este time está cheio! O limite é de ${maxClanMembers} membros.`);
      return;
    }

    setJoining(clanId);
    try {
      const { error } = await supabase.from('clan_memberships').insert({ clan_id: clanId, user_id: user.id, role: 'member', status: 'pending' });
      if (error) { alert('Erro ao entrar no time: ' + error.message); return; }
      alert('Solicitação enviada! Aguarde aprovação do capitão do time.');
      setTick((v) => v + 1);
    } finally {
      setJoining(null);
    }
  };

  const handleLeaveClan = async () => {
    if (!myMembership || !user) return;
    const msg = myMembership.role === 'captain'
      ? 'Você é o capitão! Se sair, o time ficará sem líder. Deseja continuar?'
      : 'Tem certeza que deseja sair do time?';
    if (!confirm(msg)) return;
    await supabase.from('clan_memberships').delete().eq('id', myMembership.id);
    setMyClan(null);
    setMyMembership(null);
    setTick((v) => v + 1);
  };

  const isCaptain = myMembership?.role === 'captain' && myMembership?.status === 'approved';
  const isApprovedMember = myMembership?.status === 'approved' && !!myClan;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">
        CARREGANDO...
      </div>
    );
  }

  if (!clansEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <Swords className="w-16 h-16 text-outline-variant" />
        <h2 className="text-2xl font-headline font-black text-on-surface uppercase italic">Times Desativados</h2>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs">
          O sistema de times ainda não foi ativado pelo administrador do box.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-black text-on-surface uppercase italic tracking-tighter">TIMES</h1>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mt-1">Forme seu time. Domine o box.</p>
        </div>
        {!myClan && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-background px-4 py-2 rounded-xl font-headline font-black text-xs uppercase italic flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Time
          </button>
        )}
      </div>

      {/* Território do Dia */}
      {territory && (
        <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5">
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2">Território do Dia</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{territory.icon}</span>
            <div>
              <h3 className="font-headline font-black text-on-surface uppercase italic">{territory.name}</h3>
              <p className="text-on-surface-variant text-xs">{territory.focus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Convites */}
      {invitations.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-[10px] text-primary font-black uppercase tracking-widest pl-2">Meus Convites</p>
          {invitations.map((invite) => (
            <div key={invite.id} className="bg-surface-container-low rounded-[2rem] border-2 p-5" style={{ borderColor: invite.clans.color }}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-headline font-black text-on-surface text-lg uppercase italic">
                    {invite.clans.banner && <span className="mr-1">{invite.clans.banner}</span>}
                    {invite.clans.name}
                  </h3>
                  <p className="text-on-surface-variant text-xs italic tracking-tight opacity-70">Você foi convidado para este time!</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAcceptInvite(invite.id)} className="p-3 bg-primary text-black rounded-2xl transition-all active:scale-95">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleRejectInvite(invite.id)} className="p-3 bg-surface-container-highest text-error rounded-2xl transition-all active:scale-95">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meu Time — membro aprovado */}
      {myClan && myMembership?.status === 'approved' && (
        <div className="bg-surface-container-low rounded-[2rem] border-2 p-5" style={{ borderColor: myClan.color }}>
          <div className="flex justify-between items-start">
            <div onClick={() => { setShowClanDetailModal(myClan); fetchClanMembers(myClan.id); }} className="cursor-pointer">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Meu Time</p>
              <h3 className="font-headline font-black text-on-surface text-xl uppercase italic flex items-center gap-2">
                {isCaptain && <Crown className="w-5 h-5" style={{ color: myClan.color }} />}
                {myClan.banner && <span>{myClan.banner}</span>}
                {myClan.name}
              </h3>
              {myClan.motto && <p className="text-on-surface-variant text-xs mt-1 italic">"{myClan.motto}"</p>}
            </div>
            <button onClick={handleLeaveClan} className="flex items-center gap-1 text-error text-xs font-black uppercase hover:underline">
              <LogOut className="w-3 h-3" /> Sair
            </button>
          </div>

          {/* Botão de energia — DominationEnergyButton */}
          {user && isApprovedMember && (
            <div className="mt-4 pt-4 border-t border-outline-variant/10">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2">Contribuir com Energia</p>
              <DominationEnergyButton
                userId={user.id}
                clanId={myClan.id}
                activityId={`territory:${today}`}
                activityType="event"
                energy={25}
                participationValid={true}
                onSuccess={() => setTick((v) => v + 1)}
              />
            </div>
          )}

          {/* Solicitações pendentes (captain only) */}
          {isCaptain && pendingRequests.length > 0 && (
            <div className="mt-6 pt-6 border-t border-outline-variant/10">
              <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                Solicitações Pendentes ({pendingRequests.length})
              </p>
              <div className="flex flex-col gap-2">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="flex justify-between items-center bg-surface-container-highest p-3 rounded-xl border border-outline-variant/10">
                    <span className="text-xs font-bold text-on-surface uppercase">{req.profiles.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveMember(req.id)} className="p-1.5 bg-primary/20 text-primary rounded-lg"><Check className="w-4 h-4" /></button>
                      <button onClick={() => handleRejectMember(req.id)} className="p-1.5 bg-error/20 text-error rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Solicitação pendente */}
      {myMembership?.status === 'pending' && myClan && (
        <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5">
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Solicitação Enviada</p>
          <h3 className="font-headline font-black text-on-surface uppercase italic">
            {myClan.banner && <span className="mr-1">{myClan.banner}</span>}{myClan.name}
          </h3>
          <p className="text-on-surface-variant text-xs mt-1">Aguardando aprovação do capitão do time.</p>
          <button onClick={handleLeaveClan} className="mt-3 text-error text-xs font-black uppercase hover:underline flex items-center gap-1">
            <X className="w-3 h-3" /> Cancelar Solicitação
          </button>
        </div>
      )}

      {/* Ranking de Times */}
      <div>
        <h2 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Ranking de Hoje
        </h2>
        <div className="flex flex-col gap-3">
          {leaderboard.map((item, idx) => {
            const isMine = myClan?.id === item.clan.id;
            const myMembershipForClan = memberships.find((m) => m.user_id === user?.id && m.clan_id === item.clan.id);
            const alreadyRequested = !!myMembershipForClan;
            return (
              <motion.div
                key={item.clan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-surface-container-low rounded-[1.5rem] border p-4 ${isMine ? 'border-2' : 'border-outline-variant/10'}`}
                style={isMine ? { borderColor: item.clan.color } : {}}
              >
                <div className="flex justify-between items-start mb-3 cursor-pointer" onClick={() => { setShowClanDetailModal(item.clan); fetchClanMembers(item.clan.id); }}>
                  <div className="flex items-center gap-3">
                    <span className="font-headline font-black text-2xl text-on-surface-variant">#{idx + 1}</span>
                    <div>
                      <h3 className="font-headline font-black text-on-surface uppercase italic flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: item.clan.color }} />
                        {item.clan.banner && <span className="text-base">{item.clan.banner}</span>}
                        {item.clan.name}
                      </h3>
                      {item.clan.motto && <p className="text-on-surface-variant text-[10px] italic">"{item.clan.motto}"</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-primary font-black text-sm"><Zap className="w-3 h-3" /> {item.energy}</div>
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${item.memberCount >= maxClanMembers ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      <Users className="w-3 h-3" /> {item.memberCount}/{maxClanMembers}
                      {item.memberCount >= maxClanMembers && <span className="uppercase tracking-widest"> · CHEIO</span>}
                    </div>
                  </div>
                </div>

                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(item.energy / maxEnergy) * 100}%`, backgroundColor: item.clan.color }} />
                </div>

                {!myClan && !alreadyRequested && (
                  <button
                    onClick={() => handleJoinClan(item.clan.id)}
                    disabled={joining === item.clan.id || item.memberCount >= maxClanMembers}
                    className={`w-full py-2 rounded-xl font-headline font-black text-xs uppercase italic border transition-all flex items-center justify-center gap-2 ${item.memberCount >= maxClanMembers ? 'border-outline-variant/10 text-on-surface-variant opacity-40 cursor-not-allowed' : 'border-outline-variant/20 text-on-surface-variant hover:border-primary hover:text-primary'}`}
                  >
                    <LogIn className="w-3 h-3" />
                    {joining === item.clan.id ? 'Solicitando...' : item.memberCount >= maxClanMembers ? 'Time Cheio' : 'Entrar no Time'}
                  </button>
                )}
                {alreadyRequested && !isMine && (
                  <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Solicitação Pendente</p>
                )}
              </motion.div>
            );
          })}

          {clans.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase italic text-sm">Nenhum time criado ainda</p>
              <p className="text-xs mt-1">Seja o primeiro a criar um time!</p>
            </div>
          )}
        </div>
      </div>

      {/* Economia de Time */}
      <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-headline font-black text-on-surface uppercase italic text-sm">Economia de Time</h2>
            <p className="text-on-surface-variant text-[10px] mt-0.5">Benefícios por presença e domínio de território.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {teamRewards.map((reward) => (
            <div key={reward.id} className="bg-surface-container-highest/50 rounded-2xl border border-outline-variant/10 p-4 flex items-start gap-3">
              <span className="text-2xl">{reward.icon}</span>
              <div className="flex-1">
                <p className="font-headline font-black text-on-surface text-xs uppercase italic">{reward.title}</p>
                <p className="text-on-surface-variant text-[10px] mt-0.5">{reward.description}</p>
                <span className={`inline-block mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  reward.type === 'real' ? 'bg-primary/20 text-primary'
                  : reward.type === 'digital' ? 'bg-secondary/20 text-secondary'
                  : 'bg-outline-variant/20 text-on-surface-variant'
                }`}>
                  {reward.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Criar Time */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-headline font-black text-on-surface text-xl uppercase italic">Criar Time</h2>
                <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-on-surface-variant" /></button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Emblema */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Emblema do Time</label>
                  <div className="flex gap-2 flex-wrap">
                    {BANNER_OPTIONS.map((b) => (
                      <button
                        key={b}
                        onClick={() => setNewClanBanner(b)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all border-2 ${
                          newClanBanner === b ? 'border-primary bg-primary/10 scale-110' : 'border-outline-variant/20 bg-surface-container-highest'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Nome do Time</label>
                  <input
                    type="text" value={newClanName} onChange={(e) => setNewClanName(e.target.value)}
                    placeholder="Ex: Os Invictos"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none"
                    maxLength={30}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Lema do Time (opcional)</label>
                  <input
                    type="text" value={newClanMotto} onChange={(e) => setNewClanMotto(e.target.value)}
                    placeholder="Ex: Sem dor, sem glória"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none"
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Cor do Time</label>
                  <div className="flex gap-3 flex-wrap">
                    {colors.map((color) => (
                      <button
                        key={color} onClick={() => setNewClanColor(color)}
                        className="w-8 h-8 rounded-full border-2 transition-all"
                        style={{ backgroundColor: color, borderColor: newClanColor === color ? 'white' : 'transparent', transform: newClanColor === color ? 'scale(1.2)' : 'scale(1)' }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateClan} disabled={!newClanName.trim() || creating}
                  className="w-full py-4 rounded-2xl font-headline font-black text-background uppercase italic disabled:opacity-50 mt-2"
                  style={{ backgroundColor: newClanColor }}
                >
                  {creating ? 'Criando...' : `${newClanBanner} Criar Time`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalhes do Time */}
      <AnimatePresence>
        {showClanDetailModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4"
            onClick={() => setShowClanDetailModal(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md max-h-[80vh] overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-10 rounded-full" style={{ backgroundColor: showClanDetailModal.color }} />
                  <div>
                    <h2 className="font-headline font-black text-on-surface text-xl uppercase italic">
                      {showClanDetailModal.banner && <span className="mr-1">{showClanDetailModal.banner}</span>}
                      {showClanDetailModal.name}
                    </h2>
                    {showClanDetailModal.motto && <p className="text-on-surface-variant text-xs italic">"{showClanDetailModal.motto}"</p>}
                  </div>
                </div>
                <button onClick={() => setShowClanDetailModal(null)}><X className="w-5 h-5 text-on-surface-variant" /></button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-highest p-4 rounded-2xl border border-outline-variant/10">
                    <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Energia Total</p>
                    <p className="font-headline font-black text-2xl text-primary italic flex items-center gap-2">
                      <Zap className="w-5 h-5" /> {leaderboard.find((l) => l.clan.id === showClanDetailModal.id)?.energy || 0}
                    </p>
                  </div>
                  <div className="bg-surface-container-highest p-4 rounded-2xl border border-outline-variant/10">
                    <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Membros</p>
                    <p className="font-headline font-black text-2xl text-on-surface italic flex items-center gap-2">
                      <Users className="w-5 h-5" /> {leaderboard.find((l) => l.clan.id === showClanDetailModal.id)?.memberCount || 0}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3 px-1">Membros do Time</h3>
                  <div className="flex flex-col gap-2">
                    {clanMembers.length > 0 ? (
                      clanMembers.sort((a, b) => b.xp - a.xp).map((m, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-surface-container-highest/50 p-3 rounded-xl border border-outline-variant/10">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-xs">
                              {m.name[0]}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-on-surface uppercase flex items-center gap-1">
                                {m.name}
                                {m.role === 'captain' && <Crown className="w-3 h-3 text-secondary" />}
                              </p>
                              <p className="text-[10px] text-on-surface-variant font-medium">{m.xp} XP acumulado</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Trophy className="w-4 h-4 text-secondary opacity-50" />}
                            {/* Capitão pode remover membros aprovados (exceto a si mesmo) */}
                            {isCaptain && myClan?.id === showClanDetailModal.id && m.id !== user?.id && (
                              <button
                                onClick={() => handleRemoveApprovedMember(m.membershipId)}
                                className="p-1 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
                                title="Remover membro"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-xs text-on-surface-variant">Carregando membros...</p>
                    )}
                  </div>
                </div>

                {/* Convidar atletas (captain only) */}
                {isCaptain && myClan?.id === showClanDetailModal.id && (
                  <div className="pt-6 border-t border-outline-variant/10">
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3 px-1">Convidar Atletas</h3>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text" value={athleteSearch}
                          onChange={(e) => { setAthleteSearch(e.target.value); searchAthletes(e.target.value); }}
                          placeholder="Buscar atleta por nome..."
                          className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                        />
                        {loadingSearch && (
                          <div className="absolute right-4 top-3.5">
                            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      {foundAthletes.length > 0 && (
                        <div className="bg-surface-container-highest/30 rounded-xl border border-outline-variant/10 overflow-hidden">
                          {foundAthletes.map((athlete) => (
                            <div key={athlete.id} className="flex justify-between items-center p-3 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-highest transition-colors">
                              <span className="text-xs font-bold text-on-surface uppercase">{athlete.name}</span>
                              <button
                                onClick={() => sendInvite(athlete.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-[10px] font-black uppercase transition-all hover:bg-primary hover:text-black"
                              >
                                <Users className="w-3.5 h-3.5" /> Convidar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
                                                            }
