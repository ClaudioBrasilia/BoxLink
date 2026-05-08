import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Plus,
  ChevronDown,
  Handshake,
  Sword,
  Zap,
  Check,
  X,
  Search,
  Timer,
  Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import AvatarPreview from '../components/AvatarPreview';
import { AvatarSlot } from '../types';
import { addReward } from '../utils/rewards';
import { useToast } from '../context/ToastContext';
import { createNotification } from '../hooks/useNotifications';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuelResult {
  [userId: string]: string | null;
}

interface Duel {
  id: string;
  challengerId: string;
  opponentIds: string[];
  acceptedBy: string[];
  status: 'pending' | 'active' | 'finished';
  winnerId?: string | null;
  betAmount: number;
  betType: 'xp' | 'coins';
  betReserved: boolean;
  betReservedAt?: string | null;
  betSettledAt?: string | null;
  betCanceledAt?: string | null;
  wodId?: string | null;
  wodName?: string;
  wodType?: string;
  wodRx?: string;
  wodCustom?: boolean;
  category: string;
  results: DuelResult;
  createdAt: string;
}

interface UserProfile {
  id: string;
  name: string;
  xp: number;
  coins: number;
  level: number;
  avatar_equipped?: any;
}

interface WodOption {
  id: string;
  name: string;
  type: string;
  date: string;
  rx?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseResultValue = (result: string, isTimeBased: boolean): number => {
  if (!result) return isTimeBased ? 999999 : 0;
  const str = result.trim();
  if (/^\d+:\d+/.test(str)) {
    const parts = str.split(':').map(Number);
    return parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseFloat(str.replace(/[^0-9.]/g, '')) || (isTimeBased ? 999999 : 0);
};

const isTimeBased = (wodType?: string) =>
  ['FOR TIME', 'TIME', 'TEMPO'].some(t => (wodType || '').toUpperCase().includes(t));

const pickWinner = (results: DuelResult, participantIds: string[], wodType?: string): string | null => {
  const timeBased = isTimeBased(wodType);
  const validIds = participantIds.filter(id => results[id]);
  if (validIds.length === 0) return null;

  return validIds.reduce((bestId, id) => {
    const bestVal = parseResultValue(results[bestId] || '', timeBased);
    const val = parseResultValue(results[id] || '', timeBased);
    return timeBased ? (val < bestVal ? id : bestId) : (val > bestVal ? id : bestId);
  });
};

const getVisibleResult = (duel: Duel, userId: string): string => {
  if (duel.status === 'finished') return duel.results[userId] || '—';
  const allParticipants = [duel.challengerId, ...duel.opponentIds];
  const allSubmitted = allParticipants.every(id => duel.results[id]);
  if (allSubmitted) return duel.results[userId] || '—';
  return duel.results[userId] ? '✓ Enviado' : 'Aguardando';
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Duels() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  // Data
  const [duels, setDuels] = useState<Duel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [wods, setWods] = useState<WodOption[]>([]);
  const [boxSettings, setBoxSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'pending'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Submissão de resultado por duelo
  const [submission, setSubmission] = useState<Record<string, string>>({});

  // Criação de duelo
  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  const [wodMode, setWodMode] = useState<'existing' | 'custom'>('existing');
  const [selectedWodId, setSelectedWodId] = useState('');
  const [category, setCategory] = useState<'RX' | 'SCALED' | 'BEGINNER'>('RX');
  const [betAmount, setBetAmount] = useState(100);
  const [betType, setBetType] = useState<'xp' | 'coins'>('xp');
  const [betEnabled, setBetEnabled] = useState(false);
  // WOD personalizado
  const [customWodName, setCustomWodName] = useState('');
  const [customWodType, setCustomWodType] = useState<'FOR TIME' | 'AMRAP' | 'EMOM'>('FOR TIME');
  const [customWodDesc, setCustomWodDesc] = useState('');

  // ─── Load ────────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [duelsRes, usersRes, wodsRes, settingsRes] = await Promise.all([
        supabase.from('duels').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name, xp, coins, level, avatar_equipped').eq('status', 'approved').neq('id', user.id),
        supabase.from('wods').select('id, name, type, date, rx').order('date', { ascending: false }).limit(30),
        supabase.from('box_settings').select('*').maybeSingle(),
      ]);

      if (duelsRes.data) {
        setDuels(duelsRes.data.map((d: any) => ({
          id: d.id,
          challengerId: d.challenger_id,
          opponentIds: d.opponent_ids ?? (d.opponent_id ? [d.opponent_id] : []),
          acceptedBy: d.accepted_by ?? [],
          status: d.status ?? 'pending',
          winnerId: d.winner_id,
          betAmount: d.bet_amount ?? d.reward_xp ?? 0,
          betType: d.bet_type ?? 'xp',
          betReserved: d.bet_reserved ?? false,
          betReservedAt: d.bet_reserved_at,
          betSettledAt: d.bet_settled_at,
          betCanceledAt: d.bet_canceled_at,
          wodId: d.wod_id,
          wodName: d.wod_name,
          wodType: d.wod_type,
          wodRx: d.wod_rx,
          wodCustom: d.wod_custom,
          category: d.category ?? 'RX',
          results: d.results ?? {},
          createdAt: d.created_at,
        })));
      }
      if (usersRes.data) setUsers(usersRes.data);
      if (wodsRes.data) setWods(wodsRes.data);
      if (settingsRes.data) setBoxSettings(settingsRes.data);
    } catch (err) {
      console.error('Error loading duels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('duels_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getUserName = (id: string) => {
    if (id === user?.id) return 'Você';
    return users.find(u => u.id === id)?.name || 'Atleta';
  };

  const getUserProfile = (id: string): UserProfile | undefined =>
    id === user?.id
      ? { id: user.id, name: user.name, xp: user.xp, coins: user.coins, level: user.level, avatar_equipped: user.avatar?.equipped }
      : users.find(u => u.id === id);

  const getDuelWinXp = () => boxSettings?.rewards?.duel_win_xp ?? 40;
  const getDuelWinCoins = () => boxSettings?.rewards?.duel_win_coins ?? 10;

  // ─── Criação de duelo ─────────────────────────────────────────────────────

  const handleCreateDuel = async () => {
    if (!user || selectedOpponents.length === 0) return;

    if (wodMode === 'existing' && !selectedWodId) {
      toast.warning('Selecione um WOD.'); return;
    }
    if (wodMode === 'custom' && (!customWodName || !customWodDesc)) {
      toast.warning('Preencha nome e descrição do WOD personalizado.'); return;
    }

    const myBalance = betType === 'xp' ? user.xp : user.coins;
    if (betEnabled && betAmount > myBalance) {
      toast.error(`Você não tem ${betType.toUpperCase()} suficiente para esta aposta.`); return;
    }
    if (betEnabled) {
      for (const opId of selectedOpponents) {
        const op = getUserProfile(opId);
        const opBalance = betType === 'xp' ? (op?.xp ?? 0) : (op?.coins ?? 0);
        if (opBalance < betAmount) {
          toast.error(`${op?.name || 'Um oponente'} não tem ${betType.toUpperCase()} suficiente.`); return;
          return;
        }
      }
    }

    setSaving(true);
    try {
      let wodData: { wodId: string | null; wodName: string; wodType: string; wodRx: string; wodCustom: boolean };

      if (wodMode === 'custom') {
        wodData = {
          wodId: null,
          wodName: customWodName,
          wodType: customWodType,
          wodRx: customWodDesc,
          wodCustom: true,
        };
      } else {
        const found = wods.find(w => w.id === selectedWodId);
        if (!found) return;
        wodData = {
          wodId: found.id,
          wodName: found.name,
          wodType: found.type,
          wodRx: found.rx || '',
          wodCustom: false,
        };
      }

      const allParticipants = [user.id, ...selectedOpponents];
      const initialResults: DuelResult = {};
      allParticipants.forEach(id => { initialResults[id] = null; });

      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        opponent_ids: selectedOpponents,
        accepted_by: [],
        status: 'pending',
        bet_amount: betEnabled ? betAmount : 0,
        bet_type: betType,
        bet_reserved: false,
        wod_id: wodData.wodId,
        wod_name: wodData.wodName,
        wod_type: wodData.wodType,
        wod_rx: wodData.wodRx,
        wod_custom: wodData.wodCustom,
        category,
        results: initialResults,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Notifica cada oponente sobre o desafio recebido
      for (const opId of selectedOpponents) {
        await createNotification(
          opId,
          'duel_created',
          '⚔️ Novo Duelo!',
          `${user.name || 'Um atleta'} te desafiou para um duelo — ${wodData.wodName}`,
          { challengerId: user.id, wodName: wodData.wodName }
        );
      }

      setSelectedOpponents([]);
      setOpponentSearch('');
      setSelectedWodId('');
      setCategory('RX');
      setBetAmount(100);
      setBetEnabled(false);
      setCustomWodName('');
      setCustomWodDesc('');
      setWodMode('existing');
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating duel:', err);
      toast.error('Erro ao criar duelo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Aceitar duelo ────────────────────────────────────────────────────────

  const handleAccept = async (duelId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const duel = duels.find(d => d.id === duelId);
      if (!duel) return;

      const newAcceptedBy = [...(duel.acceptedBy || []), user.id];
      const allAccepted = newAcceptedBy.length === duel.opponentIds.length;

      const updates: any = {
        accepted_by: newAcceptedBy,
        status: allAccepted ? 'active' : 'pending',
        updated_at: new Date().toISOString(),
      };

      if (allAccepted && !duel.betReserved && duel.betAmount > 0) {
        const allParticipants = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants) {
          const profile = getUserProfile(pid);
          if (!profile) continue;
          if (duel.betType === 'xp') {
            const newXp = Math.max(0, (profile.xp || 0) - duel.betAmount);
            await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, xp: newXp });
          } else {
            const newCoins = Math.max(0, (profile.coins || 0) - duel.betAmount);
            await supabase.from('profiles').update({ coins: newCoins }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, coins: newCoins });
          }
        }
        updates.bet_reserved = true;
        updates.bet_reserved_at = new Date().toISOString();
      }

      await supabase.from('duels').update(updates).eq('id', duelId);

      // Notifica o criador do duelo que foi aceito
      if (duel.challengerId !== user.id) {
        await createNotification(
          duel.challengerId,
          'duel_accepted',
          '✅ Duelo Aceito!',
          `${user.name || 'Um atleta'} aceitou seu duelo — ${duel.wodName || 'duelo'}`,
          { duelId, acceptedBy: user.id }
        );
      }
      // Se todos aceitaram, notifica todos os participantes que o duelo está ativo
      if (allAccepted) {
        const allParticipants = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants) {
          if (pid === user.id) continue;
          await createNotification(
            pid,
            'duel_accepted',
            '🥊 Duelo Ativo!',
            `Todos aceitaram! Submeta seu resultado no duelo — ${duel.wodName || 'duelo'}`,
            { duelId }
          );
        }
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#CAFD00', '#ffffff', '#000000'],
      });

      await loadData();
    } catch (err: any) {
      console.error('Error accepting duel:', err);
      toast.error('Erro ao aceitar duelo.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Cancelar duelo ───────────────────────────────────────────────────────

  const handleCancel = async (duelId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const duel = duels.find(d => d.id === duelId);
      if (!duel) return;

      if (duel.betReserved && duel.betAmount > 0 && !duel.betSettledAt) {
        const allParticipants = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants) {
          const profile = getUserProfile(pid);
          if (!profile) continue;
          if (duel.betType === 'xp') {
            const newXp = (profile.xp || 0) + duel.betAmount;
            await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, xp: newXp });
          } else {
            const newCoins = (profile.coins || 0) + duel.betAmount;
            await supabase.from('profiles').update({ coins: newCoins }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, coins: newCoins });
          }
        }
      }

      await supabase.from('duels').delete().eq('id', duelId);
      setDuels(prev => prev.filter(d => d.id !== duelId));
      if (expandedId === duelId) setExpandedId(null);
      toast.success('Duelo cancelado e removido.');
    } catch (err: any) {
      console.error('Error canceling duel:', err);
      toast.error('Erro ao cancelar duelo.');
    } finally {
      setSaving(false);
    }
  };


  // ─── Submeter resultado ───────────────────────────────────────────────────

  const handleSubmitResult = async (duel: Duel) => {
    if (!user) return;
    const result = submission[duel.id]?.trim();
    if (!result) {
      toast.warning('Preencha seu resultado.'); return;
    }

    setSaving(true);
    try {
      const newResults: DuelResult = { ...duel.results, [user.id]: result };
      const allParticipants = [duel.challengerId, ...duel.opponentIds];
      const allSubmitted = allParticipants.every(id => newResults[id]);

      if (allSubmitted) {
        const winnerId = pickWinner(newResults, allParticipants, duel.wodType);

        const updates: any = {
          results: newResults,
          status: 'finished',
          winner_id: winnerId,
          updated_at: new Date().toISOString(),
        };

        if (duel.betReserved && duel.betAmount > 0 && !duel.betSettledAt && winnerId) {
          const losers = allParticipants.filter(id => id !== winnerId);
          const winnings = duel.betAmount * losers.length;

          // Busca saldos frescos do banco para evitar usar estado React desatualizado
          const { data: freshProfiles } = await supabase
            .from('profiles')
            .select('id, xp, coins')
            .in('id', allParticipants);

          // Vencedor recebe tudo: sua aposta + a de cada perdedor
          const totalPrize = duel.betAmount * allParticipants.length;
          const fresh = freshProfiles?.find(p => p.id === winnerId);
          if (fresh) {
            if (duel.betType === 'xp') {
              const newXp = (fresh.xp || 0) + totalPrize;
              await supabase.from('profiles').update({ xp: newXp }).eq('id', winnerId);
              if (winnerId === user.id) updateUser({ ...user, xp: newXp });
            } else {
              const newCoins = (fresh.coins || 0) + totalPrize;
              await supabase.from('profiles').update({ coins: newCoins }).eq('id', winnerId);
              if (winnerId === user.id) updateUser({ ...user, coins: newCoins });
            }
          }
          // Perdedores não recebem nada — aposta já foi descontada no aceite
          updates.bet_settled_at = new Date().toISOString();
        }

        if (winnerId) {
          await addReward(
            winnerId,
            'duel',
            getDuelWinXp(),
            getDuelWinCoins(),
            `Vitória no duelo — ${duel.wodName || 'duelo'}`,
            duel.id,
          );
          if (winnerId === user.id) {
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.5 },
              colors: ['#CAFD00', '#FFFFFF'],
            });
            toast.success(`🏆 Você venceu! +${getDuelWinXp()} XP, +${getDuelWinCoins()} coins`);
          } else {
            toast.success(`Duelo finalizado! Vencedor: ${getUserName(winnerId)}`);
          }
        }

        await supabase.from('duels').update(updates).eq('id', duel.id);

        // Notifica todos os participantes sobre o resultado final
        const allParticipants2 = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants2) {
          const isWinner = pid === winnerId;
          await createNotification(
            pid,
            'duel_finished',
            isWinner ? '🏆 Você Venceu o Duelo!' : '💪 Duelo Finalizado!',
            isWinner
              ? `Parabéns! Você venceu o duelo — ${duel.wodName || 'duelo'}`
              : `Duelo encerrado. Vencedor: ${winnerId ? getUserName(winnerId) : 'Empate'} — ${duel.wodName || 'duelo'}`,
            { duelId: duel.id, winnerId }
          );
        }
      } else {
        await supabase.from('duels').update({
          results: newResults,
          updated_at: new Date().toISOString(),
        }).eq('id', duel.id);

        // Notifica os outros participantes que ainda não submeteram
        const allParticipants3 = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants3) {
          if (pid === user.id || newResults[pid]) continue;
          await createNotification(
            pid,
            'duel_result',
            '⏳ Resultado Aguardando',
            `${user.name || 'Um atleta'} já submeteu o resultado. Submeta o seu! — ${duel.wodName || 'duelo'}`,
            { duelId: duel.id }
          );
        }
      }

      setSubmission(prev => ({ ...prev, [duel.id]: '' }));
      await loadData();
    } catch (err: any) {
      console.error('Error submitting result:', err);
      toast.error('Erro ao submeter resultado: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const filteredDuels = useMemo(() => duels.filter(d => {
    if (activeTab === 'mine') return d.challengerId === user?.id || d.opponentIds.includes(user?.id || '');
    if (activeTab === 'pending') return d.status === 'pending' && d.opponentIds.includes(user?.id || '') && !d.acceptedBy.includes(user?.id || '');
    return true;
  }), [duels, activeTab, user]);

  const filteredOpponents = users.filter(u =>
    u.name.toLowerCase().includes(opponentSearch.toLowerCase()) &&
    !selectedOpponents.includes(u.id)
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-32">

      {/* Header */}
      <header className="p-6 pt-12 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-headline font-black italic text-on-surface uppercase tracking-tight">
              Duelos
            </h1>
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60">
              Desafie e conquiste
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sword className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-surface-container-highest p-1 rounded-2xl">
          {(['all', 'mine', 'pending'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                activeTab === tab
                  ? 'bg-primary text-background shadow-lg'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              {tab === 'all' ? 'Todos' : tab === 'mine' ? 'Meus' : 'Pendentes'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Formulário de criação ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mb-4 bg-surface-container rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-5"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Novo Desafio</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            {/* Busca de oponente */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                Oponentes
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Buscar atleta pelo nome..."
                  value={opponentSearch}
                  onChange={e => setOpponentSearch(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl pl-9 pr-4 py-3 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/40 outline-none"
                />
              </div>
              {opponentSearch.length > 0 && (
                <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 max-h-40 overflow-y-auto">
                  {filteredOpponents.length === 0 ? (
                    <p className="text-center text-on-surface-variant text-xs py-4 font-bold uppercase">Nenhum atleta encontrado</p>
                  ) : filteredOpponents.map(op => (
                    <button
                      key={op.id}
                      onClick={() => { setSelectedOpponents(prev => [...prev, op.id]); setOpponentSearch(''); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-headline font-black text-sm text-on-surface">
                        {op.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface uppercase italic">{op.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-bold">Nível {op.level} • {op.xp} XP</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedOpponents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedOpponents.map(id => (
                    <div key={id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full">
                      <span className="text-[11px] font-black uppercase">{getUserName(id)}</span>
                      <button onClick={() => setSelectedOpponents(prev => prev.filter(x => x !== id))}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WOD */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">WOD</label>
                <button
                  onClick={() => setWodMode(m => m === 'existing' ? 'custom' : 'existing')}
                  className="text-[10px] font-black text-primary uppercase tracking-widest"
                >
                  {wodMode === 'existing' ? '+ Criar personalizado' : '← Usar existente'}
                </button>
              </div>

              {wodMode === 'existing' ? (
                <select
                  value={selectedWodId}
                  onChange={e => setSelectedWodId(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                >
                  <option value="">Selecione um WOD</option>
                  {wods.map(w => (
                    <option key={w.id} value={w.id}>{w.name} • {w.date} • {w.type}</option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Nome do WOD"
                    value={customWodName}
                    onChange={e => setCustomWodName(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
                  <select
                    value={customWodType}
                    onChange={e => setCustomWodType(e.target.value as any)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  >
                    <option value="FOR TIME">For Time</option>
                    <option value="AMRAP">AMRAP</option>
                    <option value="EMOM">EMOM</option>
                  </select>
                  <textarea
                    placeholder="Descrição / Movimentos"
                    value={customWodDesc}
                    onChange={e => setCustomWodDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* Categoria */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Categoria</label>
              <div className="flex gap-2">
                {(['RX', 'SCALED', 'BEGINNER'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      category === cat ? 'bg-primary text-background shadow-lg' : 'bg-surface-container-highest text-on-surface-variant'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Aposta */}
            <div className="bg-surface-container-highest/50 rounded-2xl p-4 flex flex-col gap-3 border border-outline-variant/10">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Modo Aposta</label>
                <button
                  onClick={() => setBetEnabled(b => !b)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-all relative',
                    betEnabled ? 'bg-primary' : 'bg-outline-variant/30'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow',
                    betEnabled ? 'left-6' : 'left-0.5'
                  )} />
                </button>
              </div>
              {betEnabled && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {(['xp', 'coins'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setBetType(t)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                          betType === t ? 'bg-primary text-background' : 'bg-surface-container-highest text-on-surface-variant'
                        )}
                      >
                        {t === 'xp' ? '⚡ XP' : '🪙 Coins'}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                      Valor por participante (seu saldo: {betType === 'xp' ? user?.xp : user?.coins} {betType.toUpperCase()})
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={betType === 'xp' ? user?.xp : user?.coins}
                      value={betAmount}
                      onChange={e => setBetAmount(Math.max(50, Number(e.target.value)))}
                      className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
                    />
                    <p className="text-[10px] text-on-surface-variant font-bold">
                      Total em risco: {betAmount * (selectedOpponents.length + 1)} {betType.toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Botão criar */}
            <button
              onClick={handleCreateDuel}
              disabled={saving || selectedOpponents.length === 0 || (wodMode === 'existing' && !selectedWodId) || (wodMode === 'custom' && (!customWodName || !customWodDesc))}
              className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            >
              {saving ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
              CRIAR DUELO
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lista de duelos ── */}
      <main className="px-6 flex flex-col gap-4">
        {loading && !duels.length ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDuels.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-12 flex flex-col items-center text-center gap-4 border border-outline-variant/10">
            <Handshake className="w-16 h-16 text-on-surface-variant/20 mb-2" />
            <p className="text-on-surface-variant font-headline font-black uppercase italic">Nenhum duelo encontrado</p>
          </div>
        ) : (
          filteredDuels.map((duel) => {
            const allParticipants = [duel.challengerId, ...duel.opponentIds];
            const isChallenger = duel.challengerId === user?.id;
            const isOpponent = duel.opponentIds.includes(user?.id || '');
            const isParticipant = isChallenger || isOpponent;
            const needsMyAcceptance = isOpponent && !duel.acceptedBy.includes(user?.id || '') && duel.status === 'pending';
            const isExpanded = expandedId === duel.id;
            const mySubmitted = Boolean(duel.results[user?.id || '']);
            const allSubmitted = allParticipants.every(id => duel.results[id]);
            const timeBased = isTimeBased(duel.wodType);

            // Duelo cancelado que este usuário pode excluir

            return (
              <motion.div
                key={duel.id}
                layout
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'bg-surface-container rounded-3xl p-5 border border-outline-variant/10 transition-all flex flex-col gap-4',
                  isExpanded && 'ring-2 ring-primary/20 bg-surface-container-high',
  
                )}
              >
                {/* Cabeçalho do card */}
                <div className="flex justify-between items-start">
                  <span className={cn(
                    'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                    duel.status === 'active' ? 'bg-primary/20 text-primary border-primary/30'
                      : duel.status === 'finished' ? 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30'
                      : 'bg-secondary/20 text-secondary border-secondary/30'
                  )}>
                    {duel.status === 'active' ? 'ATIVO' : duel.status === 'finished' ? 'FINALIZADO' : 'PENDENTE'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(isExpanded ? null : duel.id)}>
                      <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                  </div>
                </div>

                {/* WOD info (sempre visível) */}
                {duel.wodName && (
                  <div className="bg-surface-container-highest/40 rounded-2xl px-4 py-3 flex items-center gap-3">
                    {timeBased
                      ? <Timer className="w-4 h-4 text-primary flex-shrink-0" />
                      : <Hash className="w-4 h-4 text-primary flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-headline font-black text-on-surface uppercase italic">{duel.wodName}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                        {duel.wodType} • {duel.category}
                        {timeBased ? ' • Menor tempo vence' : ' • Maior resultado vence'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Detalhes do WOD expansíveis */}
                <AnimatePresence>
                  {isExpanded && duel.wodRx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-surface-container-highest/30 rounded-2xl px-4 py-3 border border-outline-variant/10"
                    >
                      <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">{duel.category}</p>
                      <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap">{duel.wodRx}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Avatares VS */}
                <div className="flex items-center justify-between gap-4">
                  {allParticipants.map((pid, i) => (
                    <React.Fragment key={pid}>
                      {i > 0 && (
                        <span className="text-on-surface-variant font-headline font-black text-sm italic opacity-40">VS</span>
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn(
                          'w-10 h-10 rounded-full border-2 bg-surface-container-highest flex items-center justify-center font-headline font-black text-base transition-colors overflow-hidden',
                          pid === duel.challengerId ? 'border-secondary' : 'border-primary'
                        )}>
                          <AvatarPreview
                            equipped={(pid === user?.id ? user?.avatar?.equipped : users.find(u => u.id === pid)?.avatar_equipped) || {} as AvatarSlot}
                            size="sm"
                            className="w-full h-full border-none shadow-none"
                          />
                        </div>
                        <span className="text-[9px] font-bold text-on-surface uppercase italic truncate max-w-[56px]">
                          {pid === user?.id ? 'VOCÊ' : getUserName(pid).split(' ')[0]}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {/* Resultados */}
                {(duel.status === 'active' || duel.status === 'finished') && (
                  <div className="flex flex-col gap-1">
                    {allParticipants.map(pid => {
                      const visible = getVisibleResult(duel, pid);
                      const isWinner = duel.winnerId === pid;
                      return (
                        <div key={pid} className={cn(
                          'flex justify-between items-center px-3 py-2 rounded-xl',
                          isWinner ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container-highest/30'
                        )}>
                          <span className="text-[11px] font-bold text-on-surface uppercase italic">
                            {getUserName(pid)}
                            {isWinner && ' 🏆'}
                          </span>
                          <span className={cn(
                            'text-[11px] font-black italic',
                            visible === 'Aguardando' ? 'text-on-surface-variant' : 'text-primary'
                          )}>
                            {visible}
                          </span>
                        </div>
                      );
                    })}
                    {duel.status === 'active' && !allSubmitted && (
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest text-center mt-1 italic">
                        Resultados revelados quando todos enviarem
                      </p>
                    )}
                  </div>
                )}

                {/* Aposta */}
                {duel.betAmount > 0 && (
                  <div className="pt-2 border-t border-outline-variant/5 flex justify-between items-center">
                    <div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                      {duel.betType === 'xp' ? <Zap className="w-3 h-3 text-primary" /> : <span>🪙</span>}
                      Aposta: {duel.betAmount} {duel.betType.toUpperCase()} cada
                    </div>
                    {duel.betCanceledAt && (
                      <span className="text-[10px] text-error font-black uppercase">Devolvido</span>
                    )}
                  </div>
                )}

                {/* ── Ações ── */}

                {/* Pendente: oponente aceita/recusa */}
                {needsMyAcceptance && (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => handleAccept(duel.id)}
                      disabled={saving}
                      className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(202,253,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      ACEITAR <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleCancel(duel.id)}
                      disabled={saving}
                      className="flex-1 bg-error-container text-on-error-container py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      RECUSAR <X className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Pendente: desafiante aguarda */}
                {duel.status === 'pending' && isChallenger && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-surface-container-highest/30 rounded-2xl p-4 border border-outline-variant/10">
                      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Aguardando:</p>
                      <p className="text-center text-xs font-headline font-black text-on-surface uppercase italic">
                        {duel.opponentIds.filter(id => !duel.acceptedBy.includes(id)).map(id => getUserName(id)).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(duel.id)}
                      disabled={saving}
                      className="w-full bg-error-container/10 text-error py-3 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:bg-error-container/20 transition-all disabled:opacity-50"
                    >
                      CANCELAR DESAFIO <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Ativo: submeter resultado */}
                {duel.status === 'active' && isParticipant && !mySubmitted && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder={timeBased ? 'Resultado (ex: 12:45)' : 'Resultado (ex: 150 reps)'}
                      value={submission[duel.id] || ''}
                      onChange={e => setSubmission(prev => ({ ...prev, [duel.id]: e.target.value }))}
                      className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
                    />
                    <button
                      onClick={() => handleSubmitResult(duel)}
                      disabled={saving || !submission[duel.id]?.trim()}
                      className="bg-primary text-background px-5 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
                    >
                      {saving ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {/* Ativo: já enviou */}
                {duel.status === 'active' && isParticipant && mySubmitted && !allSubmitted && (
                  <p className="text-center text-[10px] text-primary font-black uppercase tracking-widest">
                    ✓ Resultado enviado — aguardando os outros
                  </p>
                )}

                {/* Ativo: cancelar */}
                {duel.status === 'active' && isParticipant && (
                  <button
                    onClick={() => handleCancel(duel.id)}
                    disabled={saving}
                    className="w-full bg-transparent text-on-surface-variant/40 py-3 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center justify-center gap-2 border border-outline-variant/10 hover:text-error hover:border-error/30 transition-all disabled:opacity-50"
                  >
                    DESISTIR / CANCELAR <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            );
          })
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowCreate(s => !s)}
        className="fixed bottom-28 right-6 w-14 h-14 bg-primary text-background rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        {showCreate ? <X className="w-6 h-6" strokeWidth={3} /> : <Plus className="w-6 h-6" strokeWidth={3} />}
      </button>
    </div>
  );
      }
