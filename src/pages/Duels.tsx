import { useState, useEffect, useCallback } from 'react';
import { Swords, Plus, Trophy, X, Check, ChevronDown, Send, Users, Dumbbell } from 'lucide-react';
import { cn } from '../lib/utils';
import { User, Wod } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

const parseTime = (t: string) => {
  const parts = t.split(':');
  if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
};

const pickWinner = (results: Record<string, string>, ids: string[]): string | null => {
  const valid = ids.filter(id => results[id]);
  if (!valid.length) return null;
  const timeBased = results[valid[0]].includes(':');
  let winnerId = valid[0];
  let winnerVal = timeBased ? parseTime(results[valid[0]]) : parseFloat(results[valid[0]]);
  for (let i = 1; i < valid.length; i++) {
    const val = timeBased ? parseTime(results[valid[i]]) : parseFloat(results[valid[i]]);
    if (timeBased ? val < winnerVal : val > winnerVal) { winnerId = valid[i]; winnerVal = val; }
  }
  return winnerId;
};

const getBetLabel = (duel: any) => {
  const bt = duel.bet_type;
  if (!bt || bt === 'xp') return `${duel.bet_xp ?? 0} XP`;
  if (bt === 'coins') return `${duel.bet_coins ?? 0} BC`;
  return `${duel.bet_xp ?? 0} XP + ${duel.bet_coins ?? 0} BC`;
};

const getRewardLabel = (duel: any) => {
  const xp = duel.reward_xp || 0;
  const coins = duel.reward_coins || 0;
  if (xp > 0 && coins > 0) return `+${xp} XP + ${coins} BC`;
  if (xp > 0) return `+${xp} XP`;
  return `+${coins} BC`;
};

const getVisibleResult = (duel: any, pid: string, allIds: string[]) => {
  const results: Record<string, string> = duel.results || {};
  const allSubmitted = allIds.every(id => results[id]);
  if (duel.status === 'finished' || allSubmitted) return results[pid] || '—';
  return results[pid] ? '✓ Enviado' : 'Aguardando...';
};

export default function Duels() {
  const { user, updateUser } = useAuth();
  const [duels, setDuels] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [wods, setWods] = useState<Wod[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isChallenging, setIsChallenging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, string>>({});

  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  const [wodMode, setWodMode] = useState<'existing' | 'custom'>('existing');
  const [selectedWodId, setSelectedWodId] = useState('');
  const [category, setCategory] = useState<'RX' | 'SCALED' | 'BEGINNER'>('RX');
  const [customWod, setCustomWod] = useState({ name: '', type: 'For Time' as 'For Time' | 'AMRAP' | 'EMOM', description: '', weight: '' });
  const [betType, setBetType] = useState<'xp' | 'coins' | 'both'>('xp');
  const [betXp, setBetXp] = useState(20);
  const [betCoins, setBetCoins] = useState(10);

  const fetchDuels = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('duels')
      .select('*, challenger:profiles!challenger_id(name, xp, coins), opponent:profiles!opponent_id(name, xp, coins)')
      .neq('status', 'finished')
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setDuels((data || []).map(d => ({
      ...d,
      challengerName: d.challenger?.name || 'Atleta',
      opponentName: d.opponent?.name || 'Atleta',
      results: d.results || {},
    })));
  }, [user?.id]);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('duels')
      .select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)')
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data || []);
  }, [user?.id]);

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id).eq('status', 'approved');
    setUsers((data || []).map((u: any) => ({
      ...u,
      avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory || [] },
      checkins: [], paidBonuses: u.paid_bonuses || [],
    })));
  }, [user?.id]);

  const fetchWods = useCallback(async () => {
    const { data } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(30);
    setWods(data || []);
    if (data && data.length > 0) setSelectedWodId(data[0].id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchDuels(); fetchHistory(); fetchUsers(); fetchWods();
    const channel = supabase.channel(`duels_rt_${user.id}`)
      .on('postgres_changes', { event: '*', table: 'duels' }, () => { fetchDuels(); fetchHistory(); })
      .subscribe();
    const poll = setInterval(() => { fetchDuels(); fetchHistory(); }, 15000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [user?.id, fetchDuels, fetchHistory, fetchUsers, fetchWods]);

  const calcRewards = () => {
    if (betType === 'xp') return { xp: betXp * 2, coins: 0 };
    if (betType === 'coins') return { xp: 0, coins: betCoins * 2 };
    return { xp: betXp * 2, coins: betCoins * 2 };
  };

  const resetForm = () => {
    setSelectedOpponents([]); setOpponentSearch('');
    setWodMode('existing'); setCustomWod({ name: '', type: 'For Time', description: '', weight: '' });
    setCategory('RX'); setBetType('xp'); setBetXp(20); setBetCoins(10);
  };

  const handleCreateDuel = async () => {
    if (!user || selectedOpponents.length === 0) { alert('Selecione pelo menos um oponente.'); return; }
    if ((betType === 'xp' || betType === 'both') && (user.xp || 0) < betXp) { alert(`XP insuficiente! Você tem ${user.xp} XP.`); return; }
    if ((betType === 'coins' || betType === 'both') && (user.coins || 0) < betCoins) { alert(`BrazaCoins insuficientes! Você tem ${user.coins} BC.`); return; }
    for (const opId of selectedOpponents) {
      const opp = users.find(u => u.id === opId);
      if ((betType === 'xp' || betType === 'both') && (opp?.xp || 0) < betXp) { alert(`${opp?.name || 'Um oponente'} não possui XP suficiente.`); return; }
      if ((betType === 'coins' || betType === 'both') && (opp?.coins || 0) < betCoins) { alert(`${opp?.name || 'Um oponente'} não possui BrazaCoins suficientes.`); return; }
    }
    if (wodMode === 'custom' && (!customWod.name || !customWod.description)) { alert('Preencha o nome e descrição do WOD personalizado.'); return; }

    setLoading(true);
    try {
      const rewards = calcRewards();
      let wodId: string | null = null;
      let wodName = '';

      if (wodMode === 'existing') {
        const found = wods.find(w => w.id === selectedWodId);
        if (!found) { alert('Selecione um WOD.'); return; }
        wodId = found.id; wodName = found.name;
      } else {
        const todayStr = formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
        const { data: savedWod, error: wodErr } = await supabase.from('wods').insert({
          date: todayStr, name: customWod.name, type: customWod.type,
          warmup: '', skill: '',
          rx: `${customWod.description}${customWod.weight ? ` — Peso: ${customWod.weight}` : ''}`,
          scaled: customWod.description, beginner: customWod.description,
        }).select().single();
        if (wodErr) { alert('Erro ao salvar WOD: ' + wodErr.message); return; }
        wodId = savedWod.id; wodName = savedWod.name;
        setWods(prev => [savedWod, ...prev]);
      }

      for (const opponentId of selectedOpponents) {
        const { error } = await supabase.from('duels').insert({
          challenger_id: user.id,
          opponent_id: opponentId,
          wod_id: wodId,
          wod_name: wodName,
          category,
          type: `${wodName} (${category})`,
          bet_type: betType,
          bet_xp: betType !== 'coins' ? betXp : 0,
          bet_coins: betType !== 'xp' ? betCoins : 0,
          reward_xp: rewards.xp,
          reward_coins: rewards.coins,
          status: 'pending',
          results: {},
        });
        if (error) { alert('Erro: ' + error.message); return; }
      }

      setIsChallenging(false); resetForm();
      alert(`Desafio${selectedOpponents.length > 1 ? 's enviados' : ' enviado'}! Aguarde o oponente aceitar.`);
      fetchDuels();
    } finally { setLoading(false); }
  };

  const handleRespond = async (duelId: string, status: 'accepted' | 'rejected') => {
    if (status === 'accepted') {
      const duel = duels.find(d => d.id === duelId);
      if (duel) {
        if ((duel.bet_type === 'xp' || duel.bet_type === 'both') && (user?.xp || 0) < duel.bet_xp) { alert('XP insuficiente!'); return; }
        if ((duel.bet_type === 'coins' || duel.bet_type === 'both') && (user?.coins || 0) < duel.bet_coins) { alert('BrazaCoins insuficientes!'); return; }
      }
    }
    setLoading(true);
    try {
      await supabase.from('duels').update({ status }).eq('id', duelId);
      fetchDuels();
    } finally { setLoading(false); }
  };

  const handleCancel = async (duel: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const allIds = [duel.challenger_id, duel.opponent_id].filter(Boolean);
      if (duel.bet_reserved) {
        for (const pid of allIds) {
          const p = users.find(u => u.id === pid);
          const currentXp = pid === user.id ? (user.xp || 0) : (p?.xp || 0);
          const currentCoins = pid === user.id ? (user.coins || 0) : (p?.coins || 0);
          const updates: any = {};
          if ((duel.bet_xp || 0) > 0) updates.xp = currentXp + duel.bet_xp;
          if ((duel.bet_coins || 0) > 0) updates.coins = currentCoins + duel.bet_coins;
          if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, ...updates });
          }
        }
      }
      await supabase.from('duels').update({ status: 'finished', winner_id: null }).eq('id', duel.id);
      fetchDuels(); fetchHistory();
      alert('Duelo cancelado.' + (duel.bet_reserved ? ' Apostas devolvidas.' : ''));
    } finally { setLoading(false); }
  };

  const handleSubmitResult = async (duel: any) => {
    if (!user) return;
    const result = submissions[duel.id]?.trim();
    if (!result) { alert('Digite seu resultado.'); return; }

    const newResults = { ...(duel.results || {}), [user.id]: result };
    const participants = [duel.challenger_id, duel.opponent_id].filter(Boolean);
    const allSubmitted = participants.every(id => newResults[id]);

    setLoading(true);
    try {
      if (allSubmitted) {
        const winnerId = pickWinner(newResults as Record<string, string>, participants);
        const loserId = participants.find(id => id !== winnerId) || '';

        await supabase.from('duels').update({ results: newResults, status: 'finished', winner_id: winnerId }).eq('id', duel.id);

        if (winnerId) {
          await addReward(winnerId, 'duel', duel.reward_xp || 40, duel.reward_coins || 0, `Vitória no duelo (${duel.wod_name || duel.type})`);
          if (loserId) {
            const loseXp = (duel.bet_xp || 0) > 0 ? -(duel.bet_xp) : 0;
            const loseCoins = (duel.bet_coins || 0) > 0 ? -(duel.bet_coins) : 0;
            await addReward(loserId, 'duel', loseXp, loseCoins, `Derrota no duelo (${duel.wod_name || duel.type})`);
          }

          // Feed post for winner
          try {
            await supabase.from('reward_history').insert({
              user_id: winnerId, type: 'duel', xp: 0, coins: 0,
              description: `🏆 Venceu duelo em ${duel.wod_name || duel.type}`,
            });
          } catch { /* non-critical */ }

          if (winnerId === user.id) {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#fff'] });
            alert(`🏆 Você venceu! +${duel.reward_xp || 40} XP${duel.reward_coins ? ` e +${duel.reward_coins} BC` : ''}!`);
          } else {
            const winnerName = duel.challenger_id === winnerId ? duel.challengerName : duel.opponentName;
            alert(`Duelo finalizado. ${winnerName} venceu.`);
          }

          const { data: prof } = await supabase.from('profiles').select('xp, coins, level').eq('id', user.id).maybeSingle();
          if (prof) updateUser({ ...user, xp: prof.xp, coins: prof.coins, level: prof.level });
        }
      } else {
        await supabase.from('duels').update({ results: newResults }).eq('id', duel.id);
        alert('Resultado enviado! Aguardando o oponente enviar o dele para revelar o vencedor.');
      }

      setSubmissions(prev => ({ ...prev, [duel.id]: '' }));
      fetchDuels(); fetchHistory();
    } catch (e) {
      console.error(e); alert('Erro ao enviar resultado.');
    } finally { setLoading(false); }
  };

  const getDuelWod = (duel: any): Wod | null => duel.wod_id ? (wods.find(w => w.id === duel.wod_id) || null) : null;
  const getCategoryContent = (wod: Wod, cat: string) => {
    if (cat === 'RX') return wod.rx;
    if (cat === 'SCALED') return wod.scaled;
    return wod.beginner;
  };

  const rewards = calcRewards();
  const filteredOpponents = users.filter(u =>
    !selectedOpponents.includes(u.id) &&
    u.name.toLowerCase().includes(opponentSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Swords className="w-8 h-8 text-secondary" /> ARENA DE DUELOS
        </h1>
        <div className="flex gap-3 text-right">
          <div>
            <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">XP</p>
            <p className="text-sm font-headline font-black text-primary">{user?.xp || 0}</p>
          </div>
          <div>
            <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">BC</p>
            <p className="text-sm font-headline font-black text-secondary">{user?.coins || 0}</p>
          </div>
        </div>
      </header>

      <button onClick={() => setIsChallenging(true)}
        className="w-full bg-secondary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(255,116,57,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2">
        NOVO DESAFIO <Plus className="w-5 h-5 fill-current" />
      </button>

      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['active', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-secondary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface")}>
            {tab === 'active' ? 'ATIVOS' : 'HISTÓRICO'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'active' && (
          <motion.div key="active" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-4">
            {duels.length === 0 && (
              <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                <Swords className="w-12 h-12 mx-auto mb-3 text-outline-variant opacity-30" />
                <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">Nenhum duelo ativo</p>
              </div>
            )}
            {duels.map(duel => {
              const isExpanded = expandedId === duel.id;
              const participants = [duel.challenger_id, duel.opponent_id].filter(Boolean);
              const myResult = (duel.results || {})[user?.id || ''];
              const allSubmitted = participants.every(id => (duel.results || {})[id]);
              const duelWod = getDuelWod(duel);
              const isChallenger = duel.challenger_id === user?.id;
              const isOpponent = duel.opponent_id === user?.id;

              return (
                <div key={duel.id} className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                      duel.status === 'accepted' ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary/20 text-secondary border-secondary/30")}>
                      {duel.status === 'accepted' ? 'ATIVO' : 'PENDENTE'}
                    </span>
                    <button onClick={() => setExpandedId(isExpanded ? null : duel.id)}>
                      <ChevronDown className={cn("w-4 h-4 text-on-surface-variant transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-5 mt-2">
                    {[
                      { id: duel.challenger_id, name: duel.challengerName, color: 'primary' },
                      { id: duel.opponent_id, name: duel.opponentName, color: 'secondary' },
                    ].map((p, i) => (
                      <div key={p.id} className="flex flex-col items-center gap-2 flex-1 relative">
                        {i === 1 && <span className="absolute left-0 right-0 text-center text-on-surface-variant font-headline font-black text-2xl italic opacity-30 pointer-events-none">VS</span>}
                        <div className={`w-14 h-14 rounded-full border-2 border-${p.color} bg-surface-container-highest flex items-center justify-center font-headline font-black text-xl text-${p.color}`}>
                          {p.name?.[0] || '?'}
                        </div>
                        <span className="text-[10px] font-bold text-on-surface uppercase italic truncate max-w-[70px]">
                          {p.id === user?.id ? 'VOCÊ' : p.name?.split(' ')[0] || 'ATLETA'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-surface-container-highest/50 rounded-2xl p-4 grid grid-cols-3 gap-2 mb-4">
                    <div>
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">WOD</p>
                      <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate">{duel.wod_name || duel.type}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Aposta</p>
                      <p className="text-xs font-headline font-black text-secondary uppercase italic">{getBetLabel(duel)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Prêmio</p>
                      <p className="text-xs font-headline font-black text-primary uppercase italic">{getRewardLabel(duel)}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mb-4 space-y-3">
                      {duelWod && (
                        <div className="bg-surface-container-highest/30 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                              {duelWod.type} — {duel.category || 'RX'}
                            </span>
                          </div>
                          <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap">
                            {getCategoryContent(duelWod, duel.category || 'RX')}
                          </p>
                        </div>
                      )}

                      {duel.status === 'accepted' && (
                        <div className="bg-surface-container-highest/30 rounded-2xl p-4 space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Resultados</p>
                          {participants.map(pid => {
                            const name = pid === duel.challenger_id ? duel.challengerName : duel.opponentName;
                            const vis = getVisibleResult(duel, pid, participants);
                            return (
                              <div key={pid} className="flex justify-between items-center">
                                <span className="text-xs font-bold text-on-surface uppercase italic">
                                  {pid === user?.id ? 'VOCÊ' : name?.split(' ')[0] || 'ATLETA'}
                                </span>
                                <span className={cn("text-xs font-headline font-black",
                                  vis === 'Aguardando...' ? "text-outline-variant" :
                                  vis === '✓ Enviado' ? "text-primary" : "text-on-surface")}>
                                  {vis}
                                </span>
                              </div>
                            );
                          })}
                          {!allSubmitted && (
                            <p className="text-[9px] text-on-surface-variant italic mt-1">
                              Resultados revelados quando ambos enviarem.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {duel.status === 'accepted' && !myResult && (
                    <div className="flex gap-2 mt-2">
                      <input type="text" placeholder="Seu resultado (ex: 12:34 ou 15 rounds)"
                        value={submissions[duel.id] || ''}
                        onChange={e => setSubmissions(prev => ({ ...prev, [duel.id]: e.target.value }))}
                        className="flex-1 bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50" />
                      <button onClick={() => handleSubmitResult(duel)} disabled={loading || !submissions[duel.id]?.trim()}
                        className="bg-primary text-background px-5 rounded-2xl font-headline font-black text-xs uppercase italic disabled:opacity-50 flex items-center gap-2">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {duel.status === 'accepted' && myResult && !allSubmitted && (
                    <p className="text-center text-[10px] text-primary font-black uppercase tracking-widest mt-2">
                      ✓ Resultado enviado — aguardando oponente...
                    </p>
                  )}

                  {duel.status === 'pending' && isOpponent && (
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => handleRespond(duel.id, 'accepted')} disabled={loading}
                        className="flex-1 bg-primary text-background py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                        ACEITAR <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleRespond(duel.id, 'rejected')} disabled={loading}
                        className="flex-1 bg-error-container text-on-error-container py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                        REJEITAR <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {duel.status === 'pending' && isChallenger && (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                        Aguardando resposta do oponente...
                      </p>
                      <button onClick={() => handleCancel(duel)} disabled={loading}
                        className="text-[10px] text-error font-black uppercase tracking-widest hover:opacity-70">
                        Cancelar
                      </button>
                    </div>
                  )}
                  {duel.status === 'accepted' && (isChallenger || isOpponent) && (
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => handleCancel(duel)} disabled={loading}
                        className="text-[10px] text-error/60 font-black uppercase tracking-widest hover:text-error transition-colors">
                        Cancelar duelo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-3">
            {history.length === 0 ? (
              <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic opacity-50">Nenhum duelo finalizado</p>
              </div>
            ) : history.map(duel => {
              const isWinner = duel.winner_id === user?.id;
              const opponent = duel.challenger_id === user?.id ? duel.opponent : duel.challenger;
              const myResult = (duel.results || {})[user?.id || ''];
              const oppResult = duel.challenger_id === user?.id
                ? (duel.results || {})[duel.opponent_id]
                : (duel.results || {})[duel.challenger_id];
              return (
                <div key={duel.id} className="bg-surface-container-low/50 p-5 rounded-3xl border border-outline-variant/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isWinner ? "bg-primary/20" : "bg-error-container/20")}>
                      {isWinner ? <Trophy className="w-5 h-5 text-primary" /> : <X className="w-5 h-5 text-error" />}
                    </div>
                    <div>
                      <p className="text-on-surface font-bold text-sm uppercase italic">
                        {isWinner ? 'Venceu' : 'Perdeu'} vs {opponent?.name || 'Atleta'}
                      </p>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                        {new Date(duel.created_at).toLocaleDateString('pt-BR')} • {duel.wod_name || duel.type}
                      </p>
                      {myResult && (
                        <p className="text-on-surface-variant text-[9px] mt-0.5">
                          Você: {myResult}{oppResult ? ` · Oponente: ${oppResult}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-headline font-black text-xs", isWinner ? "text-primary" : "text-error")}>
                      {isWinner ? `+${duel.reward_xp || 0} XP` : `-${duel.bet_xp || 0} XP`}
                    </p>
                    {(duel.reward_coins > 0 || duel.bet_coins > 0) && (
                      <p className={cn("font-headline font-black text-[10px]", isWinner ? "text-secondary" : "text-error")}>
                        {isWinner ? `+${duel.reward_coins} BC` : `-${duel.bet_coins || 0} BC`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Novo Desafio ── */}
      <AnimatePresence>
        {isChallenging && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">DESAFIAR ATLETA</h3>
                <button onClick={() => { setIsChallenging(false); resetForm(); }} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">

                {/* Oponentes */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3 h-3" /> Oponentes
                  </label>
                  <input type="text" placeholder="Buscar por nome..."
                    value={opponentSearch} onChange={e => setOpponentSearch(e.target.value)}
                    className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none" />
                  {opponentSearch && filteredOpponents.length > 0 && (
                    <div className="bg-surface-container-highest rounded-2xl p-2 max-h-36 overflow-y-auto space-y-1">
                      {filteredOpponents.map(u => (
                        <button key={u.id} onClick={() => { setSelectedOpponents(prev => [...prev, u.id]); setOpponentSearch(''); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container-low transition-colors">
                          <p className="text-sm font-bold text-on-surface">{u.name}</p>
                          <p className="text-[10px] text-on-surface-variant">Nível {u.level}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {opponentSearch && filteredOpponents.length === 0 && (
                    <p className="text-xs text-on-surface-variant italic px-2">Nenhum atleta encontrado.</p>
                  )}
                  {selectedOpponents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedOpponents.map(id => {
                        const u = users.find(u => u.id === id);
                        return (
                          <span key={id} className="bg-secondary/20 text-secondary border border-secondary/30 text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-2">
                            {u?.name}
                            <button onClick={() => setSelectedOpponents(prev => prev.filter(i => i !== id))} className="hover:text-error">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* WOD */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
                      <Dumbbell className="w-3 h-3" /> WOD
                    </label>
                    <button onClick={() => setWodMode(m => m === 'existing' ? 'custom' : 'existing')}
                      className="text-[10px] text-primary font-black uppercase tracking-widest hover:opacity-70">
                      {wodMode === 'existing' ? '+ Criar personalizado' : '← Selecionar existente'}
                    </button>
                  </div>
                  {wodMode === 'existing' ? (
                    <select value={selectedWodId} onChange={e => setSelectedWodId(e.target.value)}
                      className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface">
                      <option value="">Selecione um WOD</option>
                      {wods.map(w => <option key={w.id} value={w.id}>{w.name} — {w.date}</option>)}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input type="text" placeholder="Nome do WOD" value={customWod.name}
                        onChange={e => setCustomWod(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm" />
                      <select value={customWod.type} onChange={e => setCustomWod(p => ({ ...p, type: e.target.value as any }))}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface">
                        <option value="For Time">For Time</option>
                        <option value="AMRAP">AMRAP</option>
                        <option value="EMOM">EMOM</option>
                      </select>
                      <textarea placeholder="Descrição / Movimentos" value={customWod.description}
                        onChange={e => setCustomWod(p => ({ ...p, description: e.target.value }))} rows={3}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm resize-none" />
                      <input type="text" placeholder="Peso sugerido (opcional)" value={customWod.weight}
                        onChange={e => setCustomWod(p => ({ ...p, weight: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm" />
                    </div>
                  )}
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Categoria</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['RX', 'SCALED', 'BEGINNER'] as const).map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)}
                        className={cn("py-3 rounded-2xl font-headline font-black text-[10px] uppercase italic transition-all border",
                          category === cat ? "bg-primary text-background border-primary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-primary/50")}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aposta */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">O que apostar?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([{ key: 'xp', label: 'XP', icon: '⚡' }, { key: 'coins', label: 'BrazaCoins', icon: '🪙' }, { key: 'both', label: 'Ambos', icon: '🔥' }] as const).map(({ key, label, icon }) => (
                      <button key={key} onClick={() => setBetType(key)}
                        className={cn("py-3 rounded-2xl font-headline font-black text-[10px] uppercase italic transition-all border",
                          betType === key ? "bg-secondary text-background border-secondary" : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-secondary/50")}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {(betType === 'xp' || betType === 'both') && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                      <span>Quantidade de XP</span>
                      <span className="text-primary">Você tem: {user?.xp || 0} XP</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setBetXp(x => Math.max(5, x - 5))} className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                      <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">{betXp} XP</div>
                      <button onClick={() => setBetXp(x => Math.min(user?.xp || 0, x + 5))} className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}

                {(betType === 'coins' || betType === 'both') && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                      <span>Quantidade de BrazaCoins</span>
                      <span className="text-secondary">Você tem: {user?.coins || 0} BC</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setBetCoins(c => Math.max(5, c - 5))} className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                      <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">{betCoins} BC</div>
                      <button onClick={() => setBetCoins(c => Math.min(user?.coins || 0, c + 5))} className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}

                {/* Resumo */}
                <div className="bg-secondary/10 p-4 rounded-2xl border border-secondary/20 space-y-1">
                  <p className="text-[10px] text-secondary font-black uppercase tracking-widest">RESUMO DA APOSTA</p>
                  <p className="text-xs text-on-surface font-bold">
                    Você aposta: <span className="text-secondary font-black">{getBetLabel({ bet_type: betType, bet_xp: betXp, bet_coins: betCoins })}</span>
                  </p>
                  <p className="text-xs text-on-surface font-bold">
                    Vencedor leva: <span className="text-primary font-black">
                      {rewards.xp > 0 && `+${rewards.xp} XP`}{rewards.xp > 0 && rewards.coins > 0 && ' + '}{rewards.coins > 0 && `+${rewards.coins} BC`}
                    </span>
                  </p>
                  {selectedOpponents.length > 1 && (
                    <p className="text-[10px] text-on-surface-variant italic">{selectedOpponents.length} duelos serão criados (1 por oponente)</p>
                  )}
                  <p className="text-[10px] text-on-surface-variant italic">Vencedor determinado automaticamente quando ambos enviarem</p>
                </div>

                <button onClick={handleCreateDuel} disabled={loading || selectedOpponents.length === 0}
                  className="w-full bg-secondary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
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
