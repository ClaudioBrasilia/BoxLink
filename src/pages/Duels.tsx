import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Swords, Plus, Trophy, X, Check, ChevronDown, Send, Search, Dumbbell, Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { createNotification, requestNotificationPermission } from '../hooks/useNotifications';

// ─── Types ────────────────────────────────────────────────────────────────────

type WodCategory = 'rx' | 'scaled' | 'beginner';
type WodType = 'For Time' | 'AMRAP' | 'EMOM';

interface WodData {
  id: string;
  date: string;
  name: string;
  type: WodType | string;
  versions?: Record<string, { description: string; weight?: string }>;
  rx?: string;
  scaled?: string;
  beginner?: string;
}

interface DuelData {
  id: string;
  wodId: string;
  wodName: string;
  category: WodCategory;
  challengerId: string;
  opponentIds: string[];
  results: Record<string, string | null>;
  status: 'pending' | 'active' | 'finished';
  winnerId: string | null;
  betMode: boolean;
  betType: string | null;
  betXpAmount: number | null;
  acceptedBy: string[];
  betReserved: boolean;
  betReservedAt: number | null;
  betSettledAt: number | null;
  betCanceledAt: number | null;
  createdAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<WodCategory, string> = {
  rx: 'RX',
  scaled: 'Scaled',
  beginner: 'Iniciante',
};

const formatDurationInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) return `0:${digits.padStart(2, '0')}`;
  const minutes = digits.slice(0, -2).replace(/^0+(?=\d)/, '');
  const seconds = digits.slice(-2);
  return `${minutes || '0'}:${seconds}`;
};

const getDurationError = (value: string): string | null => {
  if (!value.trim()) return 'Preencha seu tempo.';
  if (!/^\d+:[0-5]\d$/.test(value.trim())) return 'Formato inválido. Use m:ss (ex: 12:34)';
  return null;
};

const toDurationSeconds = (value: string): number => {
  if (getDurationError(value)) return Infinity;
  const [m, s] = value.split(':').map(Number);
  return m * 60 + s;
};

const isTimeScore = (wod: WodData | undefined): boolean =>
  !!wod && (wod.type === 'For Time' || wod.type?.toLowerCase().includes('for time'));

const toValue = (result: string) => {
  if (result.includes(':')) return { kind: 'time' as const, value: toDurationSeconds(result) };
  const r = Number(result);
  return { kind: 'rounds' as const, value: isNaN(r) ? 0 : r };
};

const pickWinner = (results: Record<string, string>, participantIds: string[]): string | null => {
  const valid = participantIds.filter(id => results[id]);
  if (!valid.length) return null;
  let winnerId = valid[0];
  let winnerVal = toValue(results[winnerId]);
  for (let i = 1; i < valid.length; i++) {
    const id = valid[i];
    const val = toValue(results[id]);
    if (winnerVal.kind === 'time' && val.kind === 'time' && val.value < winnerVal.value) {
      winnerId = id; winnerVal = val;
    } else if (winnerVal.kind === 'rounds' && val.kind === 'rounds' && val.value > winnerVal.value) {
      winnerId = id; winnerVal = val;
    }
  }
  return winnerId;
};

const getVisibleResult = (duel: DuelData, userId: string): string => {
  const results = duel.results || {};
  const allParts = [duel.challengerId, ...(duel.opponentIds || [])];
  const allSubmitted = allParts.every(id => results[id]);
  if (duel.status === 'finished' || allSubmitted) return results[userId] || '—';
  return results[userId] ? '✓ Enviado' : 'Aguardando...';
};

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function mapDuelFromDb(r: any): DuelData {
  return {
    id: r.id,
    wodId: r.wod_id || '',
    wodName: r.wod_name || r.type || 'Duelo',
    category: r.category || 'rx',
    challengerId: r.challenger_id,
    opponentIds: Array.isArray(r.opponent_ids) ? r.opponent_ids : (r.opponent_id ? [r.opponent_id] : []),
    results: r.results || {},
    status: r.status === 'accepted' ? 'active' : (r.status || 'pending'),
    winnerId: r.winner_id || null,
    betMode: Boolean(r.bet_mode),
    betType: r.bet_type || null,
    betXpAmount: r.bet_xp_amount ?? r.bet_xp ?? null,
    acceptedBy: Array.isArray(r.accepted_by) ? r.accepted_by : [],
    betReserved: Boolean(r.bet_reserved),
    betReservedAt: r.bet_reserved_at || null,
    betSettledAt: r.bet_settled_at || null,
    betCanceledAt: r.bet_canceled_at || null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

async function fetchDuelsFromDb(): Promise<DuelData[]> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(mapDuelFromDb);
}

async function fetchWodsFromDb(): Promise<WodData[]> {
  const { data } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(30);
  return (data || []).map((d: any) => ({
    id: d.id,
    date: d.date,
    name: d.name,
    type: d.type,
    versions: d.versions || undefined,
    rx: d.rx,
    scaled: d.scaled,
    beginner: d.beginner,
  }));
}

async function createDuelInDb(duel: DuelData): Promise<void> {
  const { error } = await supabase.from('duels').insert({
    id: duel.id,
    wod_id: duel.wodId || null,
    wod_name: duel.wodName,
    category: duel.category,
    challenger_id: duel.challengerId,
    opponent_id: duel.opponentIds[0] || null,
    opponent_ids: duel.opponentIds,
    results: duel.results,
    status: 'pending',
    winner_id: null,
    bet_mode: duel.betMode,
    bet_type: duel.betType,
    bet_xp: duel.betXpAmount,
    bet_xp_amount: duel.betXpAmount,
    accepted_by: [],
    bet_reserved: false,
  } as any);
  if (error) { console.error(error); throw new Error('Falha ao criar duelo.'); }
}

async function updateDuelInDb(id: string, updates: Record<string, any>): Promise<void> {
  const db: Record<string, any> = {};
  if (updates.results !== undefined) db.results = updates.results;
  if (updates.status !== undefined) db.status = updates.status === 'active' ? 'accepted' : updates.status;
  if (updates.winnerId !== undefined) db.winner_id = updates.winnerId;
  if (updates.acceptedBy !== undefined) db.accepted_by = updates.acceptedBy;
  if (updates.betReserved !== undefined) db.bet_reserved = updates.betReserved;
  if (updates.betReservedAt !== undefined) db.bet_reserved_at = updates.betReservedAt;
  if (updates.betSettledAt !== undefined) db.bet_settled_at = updates.betSettledAt;
  if (updates.betCanceledAt !== undefined) db.bet_canceled_at = updates.betCanceledAt;
  const { error } = await supabase.from('duels').update(db).eq('id', id);
  if (error) { console.error(error); throw new Error('Falha ao atualizar duelo.'); }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Duels() {
  const { user, updateUser } = useAuth();

  const [duels, setDuels] = useState<DuelData[]>([]);
  const [wods, setWods] = useState<WodData[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Create duel form
  const [showCreate, setShowCreate] = useState(false);
  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  const [wodId, setWodId] = useState('');
  const [category, setCategory] = useState<WodCategory>('rx');
  const [betMode, setBetMode] = useState(false);
  const [betXpAmount, setBetXpAmount] = useState(100);
  const [createMode, setCreateMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<WodType>('For Time');
  const [customDescription, setCustomDescription] = useState('');

  // UI state
  const [submissions, setSubmissions] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'finished'>('active');

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [loadedDuels, loadedWods, profilesRes] = await Promise.all([
        fetchDuelsFromDb(),
        fetchWodsFromDb(),
        supabase.from('profiles').select('id, name, xp, level').eq('status', 'approved').neq('id', user.id),
      ]);
      setDuels(loadedDuels);
      setWods(loadedWods);
      if (loadedWods[0] && !wodId) setWodId(loadedWods[0].id);
      setUsers(profilesRes.data || []);
    } finally {
      setInitialLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    loadAll();
    requestNotificationPermission();

    const channel = supabase
      .channel(`duels_rt_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, loadAll)
      .subscribe();

    const poll = setInterval(loadAll, 15000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [user?.id, loadAll]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const myDuels = useMemo(() =>
    (duels || []).filter(d =>
      d.challengerId === user?.id || (d.opponentIds || []).includes(user?.id || '')
    ),
    [duels, user?.id]
  );

  const duelGroups = useMemo(() => ({
    pending: myDuels.filter(d => d.status === 'pending'),
    active: myDuels.filter(d => d.status === 'active'),
    finished: myDuels.filter(d => d.status === 'finished'),
  }), [myDuels]);

  const getUserName = (id: string) =>
    id === user?.id ? (user?.name || 'Você') : ((users || []).find(u => u.id === id)?.name || 'Atleta');

  const getWod = (id: string) => (wods || []).find(w => w.id === id);

  const isTimeDuel = (duel: DuelData) => isTimeScore(getWod(duel.wodId));

  const filteredOpponents = opponentSearch
    ? (users || []).filter(u => u.name?.toLowerCase().includes(opponentSearch.toLowerCase()))
    : [];

  // ─── Create duel ────────────────────────────────────────────────────────────

  const handleCreateDuel = async () => {
    if (!user || selectedOpponents.length === 0) {
      alert('Selecione pelo menos um oponente.'); return;
    }
    if (betMode && betXpAmount > (user.xp || 0)) {
      alert(`XP insuficiente! Você tem ${user.xp} XP.`); return;
    }
    if (betMode) {
      for (const oppId of selectedOpponents) {
        const opp = (users || []).find(u => u.id === oppId);
        if (!opp || (opp.xp || 0) < betXpAmount) {
          alert(`${opp?.name || 'Um oponente'} não tem XP suficiente para a aposta.`); return;
        }
      }
    }

    let duelWodId = wodId;
    let duelWodName = getWod(wodId)?.name || 'WOD';

    if (createMode) {
      if (!customName || !customDescription) {
        alert('Preencha o nome e a descrição do WOD.'); return;
      }
      const newWodId = `wod_custom_${Date.now()}`;
      try {
        await supabase.from('wods').insert({
          id: newWodId,
          date: new Date().toISOString().split('T')[0],
          name: customName,
          type: customType,
          versions: {
            rx: { description: customDescription },
            scaled: { description: customDescription },
            beginner: { description: customDescription },
          },
        } as any);
        setWods(prev => [{ id: newWodId, date: new Date().toISOString().split('T')[0], name: customName, type: customType }, ...prev]);
      } catch { alert('Falha ao salvar WOD personalizado.'); return; }
      duelWodId = newWodId;
      duelWodName = customName;
    }

    setLoading(true);
    try {
      const allParticipants = [user.id, ...selectedOpponents];
      const results: Record<string, null> = {};
      allParticipants.forEach(id => { results[id] = null; });

      const duel: DuelData = {
        id: `duel_${Date.now()}`,
        wodId: duelWodId,
        wodName: duelWodName,
        category,
        challengerId: user.id,
        opponentIds: selectedOpponents,
        results,
        status: 'pending',
        winnerId: null,
        betMode,
        betType: betMode ? 'xp' : null,
        betXpAmount: betMode ? betXpAmount : null,
        acceptedBy: [],
        betReserved: false,
        betReservedAt: null,
        betSettledAt: null,
        betCanceledAt: null,
        createdAt: Date.now(),
      };

      await createDuelInDb(duel);
      setDuels(prev => [duel, ...prev]);

      for (const oppId of selectedOpponents) {
        await createNotification(
          oppId,
          'duel_challenge',
          '⚔️ Você foi desafiado!',
          `${user.name} te desafiou para um duelo de ${duelWodName} (${CATEGORY_LABELS[category]})${betMode ? `. Aposta: ${betXpAmount} XP` : ''}.`,
          { duel_id: duel.id, challenger_name: user.name }
        );
      }

      alert(`Duelo criado! Os oponentes precisam aceitar.`);
      setShowCreate(false);
      setSelectedOpponents([]);
      setCreateMode(false);
      setCustomName('');
      setCustomDescription('');
      setBetMode(false);
      setBetXpAmount(100);
      setActiveTab('pending');
    } catch (e: any) {
      alert(e.message || 'Erro ao criar duelo.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Accept duel ─────────────────────────────────────────────────────────────

  const handleAccept = async (duelId: string) => {
    if (!user) return;
    const duel = (duels || []).find(d => d.id === duelId);
    if (!duel || !(duel.opponentIds || []).includes(user.id)) return;

    if (duel.betMode && duel.betXpAmount && (user.xp || 0) < duel.betXpAmount) {
      alert(`XP insuficiente! Você precisa de ${duel.betXpAmount} XP para aceitar.`); return;
    }

    setLoading(true);
    try {
      const newAcceptedBy = [...(duel.acceptedBy || []), user.id];
      const allAccepted = (duel.opponentIds || []).every(id => newAcceptedBy.includes(id));
      const newStatus = allAccepted ? 'active' : 'pending';

      const updates: Record<string, any> = { acceptedBy: newAcceptedBy, status: newStatus };

      if (allAccepted && !duel.betReserved && duel.betMode && duel.betXpAmount) {
        const amount = duel.betXpAmount;
        const allParts = [duel.challengerId, ...(duel.opponentIds || [])];
        for (const pid of allParts) {
          const p = pid === user.id ? user : (users || []).find(u => u.id === pid);
          if (p) {
            const newXp = Math.max(0, (p.xp || 0) - amount);
            await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, xp: newXp });
          }
        }
        updates.betReserved = true;
        updates.betReservedAt = Date.now();
      }

      await updateDuelInDb(duelId, updates);
      setDuels(prev => prev.map(d => d.id === duelId ? { ...d, ...updates, status: newStatus } : d));

      await createNotification(
        duel.challengerId,
        'duel_accepted',
        '✅ Duelo aceito!',
        `${user.name} aceitou seu desafio de ${duel.wodName}! Boa sorte!`,
        { duel_id: duelId }
      );

      alert(allAccepted ? 'Duelo ativo! Bora treinar! 💪' : 'Você aceitou. Aguardando outros oponentes.');
    } finally { setLoading(false); }
  };

  // ─── Cancel / Refuse ─────────────────────────────────────────────────────────

  const handleCancel = async (duelId: string) => {
    if (!user) return;
    const duel = (duels || []).find(d => d.id === duelId);
    if (!duel) return;
    const isChallenger = duel.challengerId === user.id;
    const isOpponent = (duel.opponentIds || []).includes(user.id);
    if (!isChallenger && !isOpponent) return;

    setLoading(true);
    try {
      if (duel.betMode && duel.betXpAmount && duel.betReserved && !duel.betSettledAt) {
        const amount = duel.betXpAmount;
        const allParts = [duel.challengerId, ...(duel.opponentIds || [])];
        for (const pid of allParts) {
          const p = pid === user.id ? user : (users || []).find(u => u.id === pid);
          if (p) {
            const newXp = (p.xp || 0) + amount;
            await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, xp: newXp });
          }
        }
      }

      const updates = { status: 'finished', winnerId: null, betCanceledAt: Date.now() };
      await updateDuelInDb(duelId, updates);
      setDuels(prev => prev.map(d => d.id === duelId ? { ...d, ...updates } : d));

      const allParts = [duel.challengerId, ...(duel.opponentIds || [])];
      for (const pid of allParts) {
        if (pid !== user.id) {
          await createNotification(pid, 'duel_canceled',
            isChallenger ? '❌ Duelo cancelado' : '❌ Duelo recusado',
            `${user.name} ${isChallenger ? 'cancelou' : 'recusou'} o duelo de ${duel.wodName}.`,
            { duel_id: duelId }
          );
        }
      }
    } finally { setLoading(false); }
  };

  // ─── Submit result ───────────────────────────────────────────────────────────

  const handleSubmitResult = async (duel: DuelData) => {
    if (!user) return;
    const result = submissions[duel.id]?.trim();
    if (!result) { alert('Digite seu resultado.'); return; }

    if (isTimeDuel(duel)) {
      const err = getDurationError(result);
      if (err) { alert(err); return; }
    }

    const newResults = { ...(duel.results || {}), [user.id]: result };
    const allParts = [duel.challengerId, ...(duel.opponentIds || [])];
    const allSubmitted = allParts.every(id => newResults[id]);

    setLoading(true);
    try {
      if (allSubmitted) {
        const winnerId = pickWinner(newResults as Record<string, string>, allParts);
        const updates: Record<string, any> = { results: newResults, status: 'finished', winnerId };

        if (duel.betMode && duel.betXpAmount && duel.betReserved && !duel.betSettledAt && winnerId) {
          const amount = duel.betXpAmount;
          const losers = allParts.filter(id => id !== winnerId);
          const winnings = amount * losers.length;
          for (const pid of allParts) {
            const p = pid === user.id ? user : (users || []).find(u => u.id === pid);
            if (p) {
              let newXp = (p.xp || 0) + amount;
              if (pid === winnerId) newXp += winnings;
              await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
              if (pid === user.id) updateUser({ ...user, xp: newXp });
            }
          }
          updates.betSettledAt = Date.now();
        }

        await updateDuelInDb(duel.id, updates);
        setDuels(prev => prev.map(d => d.id === duel.id ? { ...d, ...updates, status: 'finished' } : d));

        const winnerName = getUserName(winnerId || '');
        for (const pid of allParts) {
          await createNotification(pid, 'duel_result',
            pid === winnerId ? '🏆 Você venceu o duelo!' : '💪 Duelo finalizado',
            pid === winnerId
              ? `Você venceu o duelo de ${duel.wodName}!${duel.betMode && duel.betXpAmount ? ` +${duel.betXpAmount * (allParts.length - 1)} XP de aposta.` : ''}`
              : `${winnerName} venceu o duelo de ${duel.wodName}. Continue treinando!`,
            { duel_id: duel.id }
          );
        }

        if (winnerId === user.id) {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#fff'] });
          alert('🏆 Você venceu! Parabéns!');
        } else {
          alert(`Duelo finalizado. ${winnerName} venceu.`);
        }
      } else {
        await updateDuelInDb(duel.id, { results: newResults });
        setDuels(prev => prev.map(d => d.id === duel.id ? { ...d, results: newResults } : d));

        for (const pid of allParts) {
          if (pid !== user.id && !(newResults[pid])) {
            await createNotification(pid, 'duel_result',
              '⏳ Resultado enviado!',
              `${user.name} já enviou o resultado de ${duel.wodName}. Envie o seu!`,
              { duel_id: duel.id }
            );
          }
        }
        alert('Resultado enviado! Aguardando os outros participantes.');
      }

      setSubmissions(prev => ({ ...prev, [duel.id]: '' }));
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar resultado.');
    } finally { setLoading(false); }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Swords className="w-10 h-10 text-secondary animate-pulse" />
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">Carregando duelos...</p>
        </div>
      </div>
    );
  }

  const currentGroup = duelGroups[activeTab];
  const tabCounts = { pending: duelGroups.pending.length, active: duelGroups.active.length, finished: duelGroups.finished.length };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">

      {/* Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Swords className="w-8 h-8 text-secondary" /> ARENA DE DUELOS
        </h1>
        <div className="text-right">
          <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">Seu XP</p>
          <p className="text-sm font-headline font-black text-primary">{user?.xp || 0}</p>
        </div>
      </header>

      {/* New challenge button */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full bg-secondary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(255,116,57,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2"
      >
        NOVO DESAFIO <Plus className="w-5 h-5 fill-current" />
      </button>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['pending', 'active', 'finished'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all relative',
              activeTab === tab ? 'bg-secondary text-background shadow-lg' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {tab === 'pending' ? 'PENDENTES' : tab === 'active' ? 'ATIVOS' : 'HISTÓRICO'}
            {tabCounts[tab] > 0 && (
              <span className={cn(
                'absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center',
                activeTab === tab ? 'bg-background text-secondary' : 'bg-secondary text-background'
              )}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Duel list */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-4">
          {currentGroup.length === 0 && (
            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
              <Swords className="w-12 h-12 mx-auto mb-3 text-outline-variant opacity-30" />
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">
                {activeTab === 'pending' ? 'Nenhum duelo pendente' : activeTab === 'active' ? 'Nenhum duelo ativo' : 'Nenhum duelo finalizado'}
              </p>
            </div>
          )}

          {currentGroup.map(duel => {
            const allParts = [duel.challengerId, ...(duel.opponentIds || [])];
            const isChallenger = duel.challengerId === user?.id;
            const isOpponent = (duel.opponentIds || []).includes(user?.id || '');
            const myResult = (duel.results || {})[user?.id || ''];
            const allSubmitted = allParts.every(id => (duel.results || {})[id]);
            const needsMyAcceptance = duel.status === 'pending' && isOpponent && !(duel.acceptedBy || []).includes(user?.id || '');
            const isExpanded = expandedId === duel.id;
            const duelWod = getWod(duel.wodId);

            return (
              <div key={duel.id} className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 relative overflow-hidden">

                {/* Top right: badges + expand toggle */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {duel.betMode && duel.betXpAmount && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                      <Zap className="w-3 h-3" />{duel.betXpAmount} XP
                    </span>
                  )}
                  <span className={cn(
                    'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                    duel.status === 'active' ? 'bg-primary/20 text-primary border-primary/30'
                      : duel.status === 'finished' ? 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30'
                        : 'bg-secondary/20 text-secondary border-secondary/30'
                  )}>
                    {duel.status === 'active' ? 'ATIVO' : duel.status === 'finished' ? 'FINALIZADO' : 'PENDENTE'}
                  </span>
                  <button onClick={() => setExpandedId(isExpanded ? null : duel.id)}>
                    <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                </div>

                {/* Participants row */}
                <div className="flex items-center gap-3 mb-4 mt-2 flex-wrap pr-32">
                  {allParts.map((pid, i) => (
                    <div key={pid} className="flex items-center gap-2">
                      {i > 0 && <span className="text-on-surface-variant font-headline font-black text-sm italic opacity-40">VS</span>}
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn(
                          'w-10 h-10 rounded-full border-2 bg-surface-container-highest flex items-center justify-center font-headline font-black text-base',
                          pid === duel.challengerId ? 'border-secondary text-secondary' : 'border-primary text-primary'
                        )}>
                          {getUserName(pid)?.[0] || '?'}
                        </div>
                        <span className="text-[9px] font-bold text-on-surface uppercase italic truncate max-w-[56px]">
                          {pid === user?.id ? 'VOCÊ' : getUserName(pid).split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* WOD info bar */}
                <div className="bg-surface-container-highest/50 rounded-2xl p-3 grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">WOD</p>
                    <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate">{duel.wodName}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</p>
                    <p className="text-xs font-headline font-black text-secondary uppercase italic">{CATEGORY_LABELS[duel.category as WodCategory] || duel.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</p>
                    <p className="text-xs font-headline font-black text-primary uppercase italic">{duelWod?.type || '—'}</p>
                  </div>
                </div>

                {/* Winner banner */}
                {duel.status === 'finished' && duel.winnerId && (
                  <div className="flex items-center gap-2 mb-3 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    <span className="text-xs font-headline font-black text-primary uppercase italic">
                      {duel.winnerId === user?.id ? 'VOCÊ VENCEU! 🏆' : `${getUserName(duel.winnerId)} VENCEU`}
                    </span>
                  </div>
                )}

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">

                      {/* WOD description */}
                      {duelWod && (() => {
                        const version = duelWod.versions?.[duel.category];
                        const desc = version?.description || (duelWod as any)[duel.category];
                        if (!desc) return null;
                        return (
                          <div className="mb-3 bg-surface-container-highest/30 border border-outline-variant/10 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Dumbbell className="w-4 h-4 text-secondary" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-secondary">{duelWod.type}</span>
                            </div>
                            <p className="text-xs text-on-surface whitespace-pre-wrap">{desc}</p>
                            {version?.weight && <p className="text-[10px] text-on-surface-variant mt-1">Peso: {version.weight}</p>}
                          </div>
                        );
                      })()}

                      {/* Results per participant */}
                      <div className="mb-3 bg-surface-container-highest/30 rounded-2xl p-4 space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Resultados</p>
                        {allParts.map(pid => (
                          <div key={pid} className="flex justify-between items-center">
                            <span className="text-xs font-bold text-on-surface uppercase italic">
                              {pid === user?.id ? 'VOCÊ' : getUserName(pid).split(' ')[0]}
                            </span>
                            <span className={cn('text-xs font-headline font-black',
                              getVisibleResult(duel, pid) === 'Aguardando...' ? 'text-outline-variant'
                                : getVisibleResult(duel, pid) === '✓ Enviado' ? 'text-primary'
                                  : 'text-on-surface'
                            )}>
                              {getVisibleResult(duel, pid)}
                            </span>
                          </div>
                        ))}
                        {duel.status === 'active' && !allSubmitted && (
                          <p className="text-[9px] text-on-surface-variant italic mt-1">Resultados revelados quando todos enviarem.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit result */}
                {duel.status === 'active' && !myResult && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      inputMode={isTimeDuel(duel) ? 'numeric' : 'text'}
                      placeholder={isTimeDuel(duel) ? 'Tempo (ex: 12:34)' : 'Resultado (rounds/reps)'}
                      value={submissions[duel.id] || ''}
                      onChange={e => {
                        const val = isTimeDuel(duel) ? formatDurationInput(e.target.value) : e.target.value;
                        setSubmissions(prev => ({ ...prev, [duel.id]: val }));
                      }}
                      className="flex-1 bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                    <button
                      onClick={() => handleSubmitResult(duel)}
                      disabled={loading || !submissions[duel.id]?.trim()}
                      className="bg-primary text-background px-5 rounded-2xl font-headline font-black text-xs uppercase italic disabled:opacity-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {duel.status === 'active' && myResult && !allSubmitted && (
                  <p className="text-center text-[10px] text-primary font-black uppercase tracking-widest mt-2">
                    ✓ Resultado enviado — aguardando outros...
                  </p>
                )}

                {/* Opponent: accept / refuse */}
                {needsMyAcceptance && (
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => handleAccept(duel.id)} disabled={loading}
                      className="flex-1 bg-primary text-background py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                      ACEITAR <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleCancel(duel.id)} disabled={loading}
                      className="flex-1 bg-error-container text-on-error-container py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                      RECUSAR <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Challenger: waiting + cancel */}
                {duel.status === 'pending' && isChallenger && (
                  <div className="flex flex-col gap-2 mt-3">
                    <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                      Aguardando: {(duel.opponentIds || []).filter(id => !(duel.acceptedBy || []).includes(id)).map(id => getUserName(id)).join(', ')}
                    </p>
                    <button onClick={() => handleCancel(duel.id)} disabled={loading}
                      className="w-full bg-surface-container-highest text-on-surface-variant py-2 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center justify-center gap-2 border border-outline-variant/20 hover:border-error/40 hover:text-error transition-all">
                      CANCELAR DESAFIO <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Active: cancel */}
                {duel.status === 'active' && (isChallenger || isOpponent) && (
                  <button onClick={() => handleCancel(duel.id)} disabled={loading}
                    className="w-full mt-2 bg-transparent text-on-surface-variant py-2 rounded-xl font-headline font-black text-[9px] uppercase italic flex items-center justify-center gap-1 border border-outline-variant/10 hover:border-error/30 hover:text-error transition-all">
                    CANCELAR DUELO <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ─── Create Duel Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl mb-4"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">DESAFIAR ATLETA</h3>
                <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">

                {/* Opponent search */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    Oponentes (1 ou mais)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="text"
                      placeholder="Buscar atleta pelo nome..."
                      value={opponentSearch}
                      onChange={e => setOpponentSearch(e.target.value)}
                      className="w-full bg-surface-container-highest border-none rounded-2xl pl-9 pr-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                  </div>
                  {filteredOpponents.length > 0 && (
                    <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 max-h-40 overflow-y-auto">
                      {filteredOpponents.map(u => (
                        <button key={u.id}
                          onClick={() => { if (!selectedOpponents.includes(u.id)) setSelectedOpponents(prev => [...prev, u.id]); setOpponentSearch(''); }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/10 transition-all text-left"
                        >
                          <span className="text-sm font-bold text-on-surface">{u.name}</span>
                          <span className="text-[10px] text-on-surface-variant">Nível {u.level || 1} · {u.xp || 0} XP</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {opponentSearch && filteredOpponents.length === 0 && (
                    <p className="text-[11px] text-on-surface-variant italic px-1">Nenhum atleta encontrado.</p>
                  )}
                  {selectedOpponents.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedOpponents.map(id => (
                        <span key={id} className="flex items-center gap-1 bg-secondary/20 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-[11px] font-black uppercase italic">
                          {getUserName(id).split(' ')[0]}
                          <button onClick={() => setSelectedOpponents(prev => prev.filter(x => x !== id))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* WOD */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">WOD</label>
                    <button onClick={() => setCreateMode(p => !p)} className="text-[10px] text-secondary font-black uppercase italic hover:opacity-80">
                      {createMode ? '← Selecionar existente' : '+ WOD personalizado'}
                    </button>
                  </div>
                  {createMode ? (
                    <div className="space-y-2">
                      <input type="text" placeholder="Nome do WOD" value={customName} onChange={e => setCustomName(e.target.value)}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50" />
                      <select value={customType} onChange={e => setCustomType(e.target.value as WodType)}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface">
                        <option value="For Time">For Time</option>
                        <option value="AMRAP">AMRAP</option>
                        <option value="EMOM">EMOM</option>
                      </select>
                      <textarea placeholder="Descrição / Movimentos" value={customDescription} onChange={e => setCustomDescription(e.target.value)} rows={3}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none" />
                    </div>
                  ) : (
                    <select value={wodId} onChange={e => setWodId(e.target.value)}
                      className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface">
                      {wods.length === 0 && <option value="">Nenhum WOD disponível</option>}
                      {wods.map(w => <option key={w.id} value={w.id}>{w.name} • {w.date}</option>)}
                    </select>
                  )}
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['rx', 'scaled', 'beginner'] as WodCategory[]).map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)}
                        className={cn('py-3 rounded-2xl font-headline font-black text-[10px] uppercase italic transition-all border',
                          category === cat ? 'bg-secondary text-background border-secondary' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-secondary/50')}>
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bet mode */}
                <div className="space-y-3 p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Modo Aposta ⚡</p>
                      <p className="text-[9px] text-on-surface-variant/60 italic">Vencedor leva tudo em XP</p>
                    </div>
                    <button onClick={() => setBetMode(p => !p)}
                      className={cn('relative w-12 h-6 rounded-full transition-all', betMode ? 'bg-secondary' : 'bg-surface-container-highest border border-outline-variant/20')}>
                      <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-background transition-all', betMode ? 'left-7' : 'left-1')} />
                    </button>
                  </div>
                  {betMode && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                        <span>XP por participante (mín. 50)</span>
                        <span className="text-primary">Você: {user?.xp || 0} XP</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setBetXpAmount(p => Math.max(50, p - 50))}
                          className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                        <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">{betXpAmount} XP</div>
                        <button onClick={() => setBetXpAmount(p => Math.min(user?.xp || 0, p + 50))}
                          className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                      </div>
                      {selectedOpponents.length > 0 && (
                        <p className="text-[10px] text-on-surface-variant italic text-center">
                          Total em risco: {betXpAmount * (selectedOpponents.length + 1)} XP — vencedor leva tudo
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCreateDuel}
                  disabled={
                    loading ||
                    selectedOpponents.length === 0 ||
                    (!createMode && !wodId) ||
                    (createMode && (!customName || !customDescription)) ||
                    (betMode && betXpAmount < 50)
                  }
                  className="w-full bg-secondary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Swords className="w-5 h-5" /> ENVIAR DESAFIO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
