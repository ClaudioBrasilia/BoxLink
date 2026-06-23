import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Swords, Plus, Crown, LogIn, Zap, Trophy, X, Check, Sparkles, LogOut, Clock, History, Settings, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
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
  season_name?: string;
  start_date?: string;
  end_date?: string;
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

interface BoxSettings {
  id: string;
  clans_enabled: boolean;
  max_clan_members: number;
  current_season?: { name: string; start_date: string; end_date: string };
  competition_mode: 'challenge' | 'season';
  allow_multiple_clans_per_user: boolean;
  auto_approve_members: boolean;
  clan_creation_requires_approval: boolean;
  is_active: boolean;
}

// Team rewards — economia de time
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

// Sugestões de emblemas (o usuário pode digitar qualquer um)
const SUGGESTED_BANNERS = ['🛡️', '⚔️', '🔥', '💪', '🦅', '🐺', '🏆', '⚡', '🌪️', '🗡️', '🎯', '🚀', '💎', '👑', '🔱', '⚓', '🌟', '🔥'];

export default function Clans() {
  const { user } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [historicClans, setHistoricClans] = useState<Clan[]>([]);
  const [memberships, setMemberships] = useState<ClanMembership[]>([]);
  const [dominationEvents, setDominationEvents] = useState<DominationEvent[]>([]);
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [myMembership, setMyMembership] = useState<ClanMembership | null>(null);
  const [boxSettings, setBoxSettings] = useState<BoxSettings>({
    id: '',
    clans_enabled: false,
    max_clan_members: 10,
    competition_mode: 'season',
    allow_multiple_clans_per_user: false,
    auto_approve_members: false,
    clan_creation_requires_approval: false,
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClanDetailModal, setShowClanDetailModal] = useState<Clan | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
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
  const [customBannerInput, setCustomBannerInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);
  const [newSeason, setNewSeason] = useState({ name: '', start_date: '', end_date: '' });

  const colors = ['#CAFD00', '#FF4444', '#4444FF', '#FF8800', '#AA44FF', '#00CCFF', '#FF44AA'];
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchAll();
  }, [tick]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch admin status
      if (user) {
        const { data: adminData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(adminData?.role === 'admin');
      }

      const { data: settings, error: settingsError } = await supabase
        .from('box_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      
      if (settingsError) {
        console.error('Erro ao ler box_settings em Clans:', settingsError);
      }

      if (settings) {
        setBoxSettings({
          id: settings.id,
          clans_enabled: settings.clans_enabled || false,
          max_clan_members: settings.max_clan_members || 10,
          current_season: settings.current_season || null,
          competition_mode: settings.competition_mode || 'season',
          allow_multiple_clans_per_user: settings.allow_multiple_clans_per_user || false,
          auto_approve_members: settings.auto_approve_members || false,
          clan_creation_requires_approval: settings.clan_creation_requires_approval || false,
          is_active: settings.is_active || true,
        });
      }

      const { data: clansData } = await supabase
        .from('clans')
        .select('*')
        .eq('is_active', true)
        .order('created_at');
      setClans(clansData || []);

      const { data: historicData } = await supabase
        .from('clans')
        .select('*')
        .eq('is_active', false)
        .order('end_date', { ascending: false });
      setHistoricClans(historicData || []);

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
    
    // Usar emblema customizado se fornecido, senão usar o selecionado
    const bannerToUse = customBannerInput.trim() || newClanBanner;
    
    setCreating(true);
    try {
      const { data: clan, error } = await supabase
        .from('clans')
        .insert({
          name: newClanName.trim(),
          motto: newClanMotto.trim(),
          color: newClanColor,
          banner: bannerToUse,
          created_by: user.id,
          is_active: true,
          requires_approval: boxSettings.clan_creation_requires_approval,
        })
        .select()
        .single();
      
      if (error) { 
        console.error('Erro ao criar time:', error);
        alert('Erro ao criar time: ' + error.message); 
        return; 
      }
      
      if (!clan) {
        alert('Erro: Não foi possível criar o time');
        return;
      }

      const { error: memberError } = await supabase.from('clan_memberships').insert({ 
        clan_id: clan.id, 
        user_id: user.id, 
        role: 'captain', 
        status: 'approved' 
      });

      if (memberError) {
        alert('Erro ao adicionar você como capitão: ' + memberError.message);
        return;
      }

      setShowCreateModal(false);
      setNewClanName('');
      setNewClanMotto('');
      setNewClanBanner('🛡️');
      setCustomBannerInput('');
      setTick((v) => v + 1);
      alert('Time criado com sucesso!');
    } catch (err: any) {
      console.error('Erro inesperado:', err);
      alert('Erro inesperado: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    if (!user) return;

    // Verifica limite de membros
    const approvedCount = memberships.filter(m => m.clan_id === clanId && m.status === 'approved').length;
    if (approvedCount >= boxSettings.max_clan_members) {
      alert(`Este time está cheio! O limite é de ${boxSettings.max_clan_members} membros.`);
      return;
    }

    setJoining(clanId);
    try {
      const { error } = await supabase.from('clan_memberships').insert({ 
        clan_id: clanId, 
        user_id: user.id, 
        role: 'member', 
        status: boxSettings.auto_approve_members ? 'approved' : 'pending' 
      });
      if (error) { alert('Erro ao entrar no time: ' + error.message); return; }
      alert(boxSettings.auto_approve_members ? 'Bem-vindo ao time!' : 'Solicitação enviada! Aguarde aprovação do capitão do time.');
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

  const handleSaveAdminSettings = async () => {
    if (!isAdmin) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('box_settings')
        .update({
          clans_enabled: boxSettings.clans_enabled,
          max_clan_members: boxSettings.max_clan_members,
          competition_mode: boxSettings.competition_mode,
          allow_multiple_clans_per_user: boxSettings.allow_multiple_clans_per_user,
          auto_approve_members: boxSettings.auto_approve_members,
          clan_creation_requires_approval: boxSettings.clan_creation_requires_approval,
        })
        .eq('id', boxSettings.id);
      
      if (error) {
        alert('Erro ao salvar configurações: ' + error.message);
      } else {
        alert('Configurações salvas com sucesso!');
        setShowAdminPanel(false);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Admin: excluir time permanentemente ──
  const handleAdminDeleteClan = async (clanId: string, clanName: string) => {
    if (!isAdmin) return;
    if (!confirm(`Excluir o time "${clanName}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('clans').delete().eq('id', clanId);
    if (error) {
      alert('Erro ao excluir time: ' + error.message);
    } else {
      alert('Time excluído.');
      setTick((v) => v + 1);
    }
  };

  // ── Admin: encerrar temporada atual (arquiva times ativos) ──
  const handleEndSeason = async () => {
    if (!isAdmin) return;
    const activeCount = clans.length;
    if (activeCount === 0) { alert('Nenhum time ativo para encerrar.'); return; }
    if (!confirm(`Encerrar temporada atual? Os ${activeCount} time(s) ativo(s) serão arquivados e o histórico preservado.`)) return;
    const { error } = await supabase.from('clans').update({ is_active: false, end_date: today }).eq('is_active', true);
    if (error) {
      alert('Erro ao encerrar temporada: ' + error.message);
    } else {
      alert('Temporada encerrada! Times arquivados com sucesso.');
      setTick((v) => v + 1);
    }
  };

  // ── Admin: excluir uma temporada inteira do histórico (times arquivados) ──
  const handleDeleteSeasonHistory = async (seasonName: string, clanIds: string[]) => {
    if (!isAdmin) return;
    if (!confirm(`Excluir permanentemente a temporada "${seasonName}" do histórico? Os ${clanIds.length} time(s) arquivado(s) serão apagados. Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('clans').delete().in('id', clanIds);
    if (error) {
      alert('Erro ao excluir temporada do histórico: ' + error.message);
    } else {
      alert('Temporada removida do histórico.');
      setTick((v) => v + 1);
    }
  };

  // ── Admin: criar/abrir nova temporada ──
  const handleCreateSeason = async () => {
    if (!isAdmin) return;
    if (!newSeason.name.trim() || !newSeason.start_date || !newSeason.end_date) {
      alert('Preencha nome, data de início e data de fim.');
      return;
    }
    if (clans.length > 0) {
      alert('Encerre a temporada atual antes de iniciar uma nova.');
      return;
    }
    setSavingSeason(true);
    try {
      const { error } = await supabase.from('box_settings')
        .update({ current_season: newSeason })
        .eq('id', boxSettings.id);
      if (error) {
        alert('Erro ao criar temporada: ' + error.message);
      } else {
        alert(`Temporada "${newSeason.name}" aberta! Os atletas já podem criar times.`);
        setNewSeason({ name: '', start_date: '', end_date: '' });
        setShowSeasonModal(false);
        setTick((v) => v + 1);
      }
    } finally {
      setSavingSeason(false);
    }
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

  if (!boxSettings.clans_enabled) {
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
      {/* Header com botão admin */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-headline font-black text-on-surface uppercase italic tracking-tighter">TIMES</h1>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mt-1">
            {boxSettings.competition_mode === 'challenge' ? '⚔️ Modo Desafio' : '📅 Modo Temporada'}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="bg-secondary text-background px-4 py-2 rounded-xl font-headline font-black text-xs uppercase italic flex items-center gap-2 hover:opacity-80 transition"
            >
              <Settings className="w-4 h-4" /> Admin
            </button>
          )}
          {!myClan && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-background px-4 py-2 rounded-xl font-headline font-black text-xs uppercase italic flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Criar Time
            </button>
          )}
        </div>
      </div>

      {/* ── Admin Panel Modal ── */}
      <AnimatePresence>
        {showAdminPanel && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4"
            onClick={() => setShowAdminPanel(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md max-h-[80vh] overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-headline font-black text-on-surface text-xl uppercase italic flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Painel Admin
                </h2>
                <button onClick={() => setShowAdminPanel(false)}><X className="w-5 h-5 text-on-surface-variant" /></button>
              </div>

              <div className="space-y-6">
                {/* Ativar/Desativar Times */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-headline font-black text-on-surface text-sm uppercase italic">Sistema de Times</p>
                      <p className="text-on-surface-variant text-xs mt-1">Ativar ou desativar o sistema</p>
                    </div>
                    <button
                      onClick={() => setBoxSettings({ ...boxSettings, clans_enabled: !boxSettings.clans_enabled })}
                      className="transition"
                    >
                      {boxSettings.clans_enabled ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-on-surface-variant" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Limite de Membros */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-3 block">
                    Limite de Alunos por Time
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={boxSettings.max_clan_members}
                      onChange={(e) => setBoxSettings({ ...boxSettings, max_clan_members: parseInt(e.target.value) || 10 })}
                      className="flex-1 bg-surface-container border-none rounded-xl p-3 font-headline font-bold text-on-surface outline-none"
                    />
                    <span className="text-on-surface-variant font-black text-sm">alunos</span>
                  </div>
                  <p className="text-on-surface-variant text-xs mt-2">Máximo de membros permitidos por time</p>
                </div>

                {/* Modo de Disputa */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-3 block">
                    Modo de Disputa
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBoxSettings({ ...boxSettings, competition_mode: 'season' })}
                      className={`flex-1 py-3 rounded-xl font-headline font-black text-xs uppercase italic transition ${
                        boxSettings.competition_mode === 'season'
                          ? 'bg-primary text-background'
                          : 'bg-surface-container border border-outline-variant/20 text-on-surface-variant'
                      }`}
                    >
                      📅 Temporada
                    </button>
                    <button
                      onClick={() => setBoxSettings({ ...boxSettings, competition_mode: 'challenge' })}
                      className={`flex-1 py-3 rounded-xl font-headline font-black text-xs uppercase italic transition ${
                        boxSettings.competition_mode === 'challenge'
                          ? 'bg-primary text-background'
                          : 'bg-surface-container border border-outline-variant/20 text-on-surface-variant'
                      }`}
                    >
                      ⚔️ Desafio
                    </button>
                  </div>
                  <p className="text-on-surface-variant text-xs mt-2">
                    {boxSettings.competition_mode === 'season' 
                      ? 'Competição durante uma temporada definida'
                      : 'Competição por desafios pontuais'}
                  </p>
                </div>

                {/* Aprovação Automática */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-headline font-black text-on-surface text-sm uppercase italic">Aprovação Automática</p>
                      <p className="text-on-surface-variant text-xs mt-1">Aprovar membros automaticamente</p>
                    </div>
                    <button
                      onClick={() => setBoxSettings({ ...boxSettings, auto_approve_members: !boxSettings.auto_approve_members })}
                      className="transition"
                    >
                      {boxSettings.auto_approve_members ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-on-surface-variant" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Múltiplos Times */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-headline font-black text-on-surface text-sm uppercase italic">Múltiplos Times</p>
                      <p className="text-on-surface-variant text-xs mt-1">Permitir usuário em vários times</p>
                    </div>
                    <button
                      onClick={() => setBoxSettings({ ...boxSettings, allow_multiple_clans_per_user: !boxSettings.allow_multiple_clans_per_user })}
                      className="transition"
                    >
                      {boxSettings.allow_multiple_clans_per_user ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-on-surface-variant" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Aprovação de Criação */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-headline font-black text-on-surface text-sm uppercase italic">Aprovar Criação</p>
                      <p className="text-on-surface-variant text-xs mt-1">Novos times requerem aprovação</p>
                    </div>
                    <button
                      onClick={() => setBoxSettings({ ...boxSettings, clan_creation_requires_approval: !boxSettings.clan_creation_requires_approval })}
                      className="transition"
                    >
                      {boxSettings.clan_creation_requires_approval ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-on-surface-variant" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Controle de Temporada e Times ── */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <p className="font-headline font-black text-on-surface text-sm uppercase italic mb-1">Controle de Temporada</p>
                  <p className="text-on-surface-variant text-xs mb-3">Abrir, encerrar e gerenciar os times da temporada</p>

                  {boxSettings.current_season?.name && clans.length > 0 ? (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 mb-3">
                      <p className="text-[10px] text-primary font-black uppercase tracking-widest">Temporada em andamento</p>
                      <p className="text-on-surface font-headline font-black italic text-sm">{boxSettings.current_season.name}</p>
                    </div>
                  ) : (
                    <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-3 mb-3">
                      <p className="text-on-surface-variant text-xs font-bold">
                        {boxSettings.current_season?.name
                          ? `Temporada "${boxSettings.current_season.name}" aberta — aguardando os atletas criarem times.`
                          : 'Nenhuma temporada aberta no momento.'}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowAdminPanel(false); setShowSeasonModal(true); }}
                      disabled={clans.length > 0}
                      className="flex-1 py-3 rounded-xl font-headline font-black text-xs uppercase italic bg-primary text-background disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Nova Temporada
                    </button>
                    <button
                      onClick={handleEndSeason}
                      disabled={clans.length === 0}
                      className="flex-1 py-3 rounded-xl font-headline font-black text-xs uppercase italic bg-error/20 text-error disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Swords className="w-4 h-4" /> Encerrar
                    </button>
                  </div>
                  {clans.length > 0 && (
                    <p className="text-on-surface-variant text-[10px] mt-2 italic">
                      Encerre a temporada atual antes de abrir uma nova.
                    </p>
                  )}
                </div>

                {/* ── Times Ativos (excluir) ── */}
                <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                  <p className="font-headline font-black text-on-surface text-sm uppercase italic mb-1">Times Ativos</p>
                  <p className="text-on-surface-variant text-xs mb-3">Excluir times permanentemente</p>
                  {clans.length === 0 ? (
                    <p className="text-on-surface-variant text-xs italic py-2">Nenhum time ativo.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {clans.map((clan) => {
                        const memberCount = memberships.filter((m) => m.clan_id === clan.id && m.status === 'approved').length;
                        return (
                          <div key={clan.id} className="flex items-center justify-between bg-surface-container rounded-xl p-3 border border-outline-variant/10">
                            <div className="flex items-center gap-2 min-w-0">
                              {clan.banner && <span className="text-lg flex-shrink-0">{clan.banner}</span>}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-on-surface uppercase truncate">{clan.name}</p>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">👥 {memberCount} membro(s)</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAdminDeleteClan(clan.id, clan.name)}
                              className="p-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors flex-shrink-0"
                              title="Excluir time"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Histórico de Temporadas ── */}
                {historicClans.length > 0 && (
                  <div className="bg-surface-container-highest rounded-2xl p-4 border border-outline-variant/10">
                    <p className="font-headline font-black text-on-surface text-sm uppercase italic mb-1">📜 Histórico de Temporadas</p>
                    <p className="text-on-surface-variant text-xs mb-3">Times de temporadas já encerradas</p>
                    <div className="flex flex-col gap-3">
                      {(() => {
                        const grouped: Record<string, Clan[]> = {};
                        historicClans.forEach((clan) => {
                          const key = clan.season_name || 'Sem temporada';
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(clan);
                        });
                        return Object.entries(grouped).map(([seasonName, seasonClans]) => (
                          <div key={seasonName} className="border border-outline-variant/10 rounded-xl overflow-hidden">
                            <div className="bg-surface-container px-3 py-2 flex justify-between items-center">
                              <div className="min-w-0">
                                <p className="font-headline font-black text-on-surface uppercase italic text-xs truncate">{seasonName}</p>
                                <p className="text-on-surface-variant text-[10px] mt-0.5">
                                  {seasonClans[0]?.start_date && new Date(seasonClans[0].start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                  {seasonClans[0]?.end_date && ` → ${new Date(seasonClans[0].end_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">
                                  {seasonClans.length} time(s)
                                </span>
                                <button
                                  onClick={() => handleDeleteSeasonHistory(seasonName, seasonClans.map((c) => c.id))}
                                  className="p-1.5 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
                                  title="Excluir temporada do histórico"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="divide-y divide-outline-variant/5">
                              {seasonClans.map((clan, i) => {
                                const memberCount = memberships.filter((m) => m.clan_id === clan.id && m.status === 'approved').length;
                                return (
                                  <div key={clan.id} className="flex items-center gap-2 p-2.5 bg-surface-container-low/50">
                                    <span className="font-headline font-black text-on-surface-variant text-xs italic w-4">#{i + 1}</span>
                                    <div className="w-2 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: clan.color }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-on-surface text-xs uppercase italic truncate">
                                        {clan.banner && <span className="mr-1">{clan.banner}</span>}{clan.name}
                                      </p>
                                      <p className="text-on-surface-variant text-[10px]">👥 {memberCount} membro(s)</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Botão Salvar */}
                <button
                  onClick={handleSaveAdminSettings}
                  disabled={savingSettings}
                  className="w-full py-4 rounded-2xl font-headline font-black text-background uppercase italic bg-primary disabled:opacity-50 transition mt-4"
                >
                  {savingSettings ? 'Salvando...' : '✓ Salvar Configurações'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Nova Temporada ── */}
      <AnimatePresence>
        {showSeasonModal && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4"
            onClick={() => setShowSeasonModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-headline font-black text-on-surface text-xl uppercase italic">Nova Temporada</h2>
                <button onClick={() => setShowSeasonModal(false)}><X className="w-5 h-5 text-on-surface-variant" /></button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Nome da Temporada</label>
                  <input
                    type="text" value={newSeason.name}
                    onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
                    placeholder="Ex: Temporada Julho 2025"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none"
                    maxLength={40}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Início</label>
                    <input
                      type="date" value={newSeason.start_date}
                      onChange={(e) => setNewSeason({ ...newSeason, start_date: e.target.value })}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-bold text-on-surface outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Fim</label>
                    <input
                      type="date" value={newSeason.end_date}
                      onChange={(e) => setNewSeason({ ...newSeason, end_date: e.target.value })}
                      className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-bold text-on-surface outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateSeason}
                  disabled={savingSeason || !newSeason.name.trim() || !newSeason.start_date || !newSeason.end_date}
                  className="w-full py-4 rounded-2xl font-headline font-black text-background uppercase italic bg-primary disabled:opacity-50 mt-2"
                >
                  {savingSeason ? 'Salvando...' : '🏁 Iniciar Temporada'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Banner de Temporada Ativa ── */}
      {boxSettings.competition_mode === 'season' && boxSettings.current_season?.name && (() => {
        const season = boxSettings.current_season;
        const endDate = season.end_date ? new Date(season.end_date + 'T12:00:00') : null;
        const startDate = season.start_date ? new Date(season.start_date + 'T12:00:00') : null;
        const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;
        const ended = daysLeft !== null && daysLeft < 0;
        const noClansYet = clans.length === 0;
        return (
          <div className={`rounded-[2rem] border p-5 ${ended ? 'bg-surface-container-highest border-outline-variant/20' : 'bg-primary/10 border-primary/30'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{ended ? '🏁' : '🏆'}</span>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${ended ? 'text-on-surface-variant' : 'text-primary'}`}>
                    {ended ? 'Temporada Encerrada' : 'Temporada Aberta'}
                  </p>
                  <p className="text-on-surface font-headline font-black italic text-base">{season.name}</p>
                  {startDate && endDate && (
                    <p className="text-on-surface-variant text-[10px] font-bold mt-0.5">
                      {startDate.toLocaleDateString('pt-BR')} → {endDate.toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              {daysLeft !== null && !ended && (
                <div className="flex flex-col items-center gap-0.5 text-primary font-black">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{daysLeft === 0 ? 'Último dia!' : `${daysLeft}d`}</span>
                </div>
              )}
            </div>
            {!ended && noClansYet && !myClan && (
              <div className="mt-4 pt-4 border-t border-primary/20 flex items-center justify-between gap-3">
                <p className="text-on-surface-variant text-xs font-bold">
                  Nenhum time ainda. Seja o primeiro a montar o seu!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-background px-4 py-2 rounded-xl font-headline font-black text-xs uppercase italic flex items-center gap-2 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" /> Criar Time
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Seu Time */}
      {myClan && (
        <div className="bg-surface-container-low rounded-[2rem] border-2 p-5" style={{ borderColor: myClan.color }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                <Crown className="w-3 h-3" /> Seu Time
              </p>
              <h2 className="font-headline font-black text-on-surface text-xl uppercase italic flex items-center gap-2">
                {myClan.banner && <span className="text-2xl">{myClan.banner}</span>}
                {myClan.name}
              </h2>
              {myClan.motto && <p className="text-on-surface-variant text-xs italic mt-1">"{myClan.motto}"</p>}
            </div>
            {isCaptain && (
              <button onClick={handleLeaveClan} className="text-error text-xs font-black uppercase hover:underline flex items-center gap-1">
                <LogOut className="w-3 h-3" /> Sair
              </button>
            )}
          </div>

          {/* Estatísticas do Time */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface-container-highest rounded-xl p-3 border border-outline-variant/10">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Energia</p>
              <p className="font-headline font-black text-primary text-lg italic flex items-center gap-1">
                <Zap className="w-4 h-4" /> {leaderboard.find((l) => l.clan.id === myClan.id)?.energy || 0}
              </p>
            </div>
            <div className="bg-surface-container-highest rounded-xl p-3 border border-outline-variant/10">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Membros</p>
              <p className="font-headline font-black text-on-surface text-lg italic">
                {leaderboard.find((l) => l.clan.id === myClan.id)?.memberCount || 0}/{boxSettings.max_clan_members}
              </p>
            </div>
          </div>

          {/* Ações do Capitão */}
          {isCaptain && (
            <div className="space-y-3 pt-4 border-t border-outline-variant/10">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Gerenciar Time</p>
              
              {/* Buscar e Convidar Atletas */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={athleteSearch}
                  onChange={(e) => {
                    setAthleteSearch(e.target.value);
                    searchAthletes(e.target.value);
                  }}
                  placeholder="Buscar atleta para convidar..."
                  className="w-full bg-surface-container-highest border-none rounded-xl p-3 text-xs font-bold text-on-surface outline-none"
                />
                {loadingSearch && <p className="text-xs text-on-surface-variant">Buscando...</p>}
                {foundAthletes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {foundAthletes.map((athlete) => (
                      <div key={athlete.id} className="flex justify-between items-center bg-surface-container-highest p-3 rounded-xl border border-outline-variant/10">
                        <span className="text-xs font-bold text-on-surface uppercase">{athlete.name}</span>
                        <button onClick={() => sendInvite(athlete.id)} className="p-1.5 bg-primary/20 text-primary rounded-lg"><Plus className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Membros Aprovados */}
              {clanMembers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-outline-variant/10">
                  <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2">Membros ({clanMembers.length})</p>
                  <div className="flex flex-col gap-2">
                    {clanMembers.map((member) => (
                      <div key={member.id} className="flex justify-between items-center bg-surface-container-highest p-3 rounded-xl border border-outline-variant/10">
                        <div className="flex-1">
                          <span className="text-xs font-bold text-on-surface uppercase">{member.name}</span>
                          <p className="text-[10px] text-on-surface-variant">{member.role === 'captain' ? 'Capitão' : 'Membro'}</p>
                        </div>
                        {member.role !== 'captain' && (
                          <button onClick={() => handleRemoveApprovedMember(member.membershipId)} className="p-1.5 bg-error/20 text-error rounded-lg"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solicitações pendentes (captain only) */}
              {pendingRequests.length > 0 && (
                <div className="mt-4 pt-4 border-t border-outline-variant/10">
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
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${item.memberCount >= boxSettings.max_clan_members ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      <Users className="w-3 h-3" /> {item.memberCount}/{boxSettings.max_clan_members}
                      {item.memberCount >= boxSettings.max_clan_members && <span className="uppercase tracking-widest"> · CHEIO</span>}
                    </div>
                  </div>
                </div>

                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(item.energy / maxEnergy) * 100}%`, backgroundColor: item.clan.color }} />
                </div>

                {!myClan && !alreadyRequested && (
                  <button
                    onClick={() => handleJoinClan(item.clan.id)}
                    disabled={joining === item.clan.id || item.memberCount >= boxSettings.max_clan_members}
                    className={`w-full py-2 rounded-xl font-headline font-black text-xs uppercase italic border transition-all flex items-center justify-center gap-2 ${item.memberCount >= boxSettings.max_clan_members ? 'border-outline-variant/10 text-on-surface-variant opacity-40 cursor-not-allowed' : 'border-outline-variant/20 text-on-surface-variant hover:border-primary hover:text-primary'}`}
                  >
                    <LogIn className="w-3 h-3" />
                    {joining === item.clan.id ? 'Solicitando...' : item.memberCount >= boxSettings.max_clan_members ? 'Time Cheio' : 'Entrar no Time'}
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
                {/* Emblema - Sugestões */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Emblema do Time (Sugestões)</label>
                  <div className="flex gap-2 flex-wrap">
                    {SUGGESTED_BANNERS.map((b) => (
                      <button
                        key={b}
                        onClick={() => {
                          setNewClanBanner(b);
                          setCustomBannerInput('');
                        }}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all border-2 ${
                          newClanBanner === b && !customBannerInput ? 'border-primary bg-primary/10 scale-110' : 'border-outline-variant/20 bg-surface-container-highest'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emblema Customizado */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Ou Digite um Emoji Customizado</label>
                  <input
                    type="text"
                    value={customBannerInput}
                    onChange={(e) => {
                      setCustomBannerInput(e.target.value);
                      if (e.target.value.trim()) {
                        setNewClanBanner(e.target.value);
                      }
                    }}
                    placeholder="Ex: 🎯 🚀 💎 👑"
                    maxLength={5}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface outline-none text-center text-2xl"
                  />
                  <p className="text-on-surface-variant text-xs">Cole qualquer emoji que desejar!</p>
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
                  {creating ? 'Criando...' : `${customBannerInput || newClanBanner} Criar Time`}
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
                      <Users className="w-5 h-5" /> {clanMembers.length}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-3">Membros do Time</p>
                  <div className="flex flex-col gap-2">
                    {clanMembers.map((member) => (
                      <div key={member.id} className="flex justify-between items-center bg-surface-container-highest p-3 rounded-xl border border-outline-variant/10">
                        <div>
                          <p className="text-xs font-bold text-on-surface uppercase">{member.name}</p>
                          <p className="text-[10px] text-on-surface-variant">{member.role === 'captain' ? '👑 Capitão' : 'Membro'}</p>
                        </div>
                        <p className="text-xs font-black text-primary">{member.xp} XP</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
