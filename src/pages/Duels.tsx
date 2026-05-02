import { useState, useEffect, useCallback } from 'react';
import { Swords, Plus, Trophy, X, Check, ChevronDown, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';
import { createNotification, requestNotificationPermission } from '../hooks/useNotifications';
import { createNotification } from '../hooks/useNotifications';

// ─── helpers ──────────────────────────────────────────────────────────────────

const parseTime = (t: string) => {
  const parts = t.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
};

const pickWinner = (results: Record<string, string>, ids: string[]): string | null => {
  const valid = ids.filter(id => results[id]);
  if (!valid.length) return null;
  const timeBased = results[valid[0]].includes(':');
  let winnerId = valid[0];
  let winnerVal = timeBased ? parseTime(results[valid[0]]) : parseInt(results[valid[0]]);
  for (let i = 1; i < valid.length; i++) {
    const val = timeBased ? parseTime(results[valid[i]]) : parseInt(results[valid[i]]);
    if (timeBased ? val < winnerVal : val > winnerVal) { winnerId = valid[i]; winnerVal = val; }
  }
  return winnerId;
};

const getBetLabel = (duel: any) => {
  if (!duel.bet_type || duel.bet_type === 'xp') return `${duel.bet_xp ?? (duel.reward_xp || 0) / 2} XP`;
  if (duel.bet_type === 'coins') return `${duel.bet_coins} BC`;
  return `${duel.bet_xp} XP + ${duel.bet_coins} BC`;
};

const getRewardLabel = (duel: any) => {
  const xp = duel.reward_xp || 0;
  const coins = duel.reward_coins || 0;
  if (xp > 0 && coins > 0) return `+${xp} XP + ${coins} BC`;
  if (xp > 0) return `+${xp} XP`;
  return `+${coins} BC`;
};

const getVisibleResult = (duel: any, pid: string) => {
  const results: Record<string, string> = duel.results || {};
  const allSubmitted = [duel.challenger_id, duel.opponent_id].every(id => results[id]);
  if (duel.status === 'finished' || allSubmitted) return results[pid] || '—';
  return results[pid] ? '✓ Enviado' : 'Aguardando...';
};

// ─── component ────────────────────────────────────────────────────────────────

export default function Duels() {
  const { user, updateUser } = useAuth();
  const [duels, setDuels] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isChallenging, setIsChallenging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, string>>({});
  const [newDuel, setNewDuel] = useState({
    opponentId: '', type: 'WOD',
    betType: 'xp' as 'xp' | 'coins' | 'both',
    betXp: 20, betCoins: 10,
    totalDays: 1,
  });

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

  useEffect(() => {
    if (!user?.id) return;
    fetchDuels(); fetchHistory(); fetchUsers();
    requestNotificationPermission();

    const channel = supabase.channel(`duels_rt_${user.id}`)
      .on('postgres_changes', { event: '*', table: 'duels' }, () => {
        fetchDuels(); fetchHistory();
      }).subscribe();

    // Fallback polling every 15s
    const poll = setInterval(() => { fetchDuels(); fetchHistory(); }, 15000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [user?.id, fetchDuels, fetchHistory, fetchUsers]);

  const calcRewards = () => {
    const { betType, betXp, betCoins } = newDuel;
    if (betType === 'xp') return { xp: betXp * 2, coins: 0 };
    if (betType === 'coins') return { xp: 0, coins: betCoins * 2 };
    return { xp: betXp * 2, coins: betCoins * 2 };
  };

  const handleCreateDuel = async () => {
    if (!user || !newDuel.opponentId) return;
    if ((newDuel.betType === 'xp' || newDuel.betType === 'both') && (user.xp || 0) < newDuel.betXp) {
      alert(`XP insuficiente! Você tem ${user.xp} XP.`); return;
    }
    if ((newDuel.betType === 'coins' || newDuel.betType === 'both') && (user.coins || 0) < newDuel.betCoins) {
      alert(`BrazaCoins insuficientes! Você tem ${user.coins} BC.`); return;
    }
    setLoading(true);
    try {
      const rewards = calcRewards();
      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        opponent_id: newDuel.opponentId,
        type: newDuel.type,
        bet_type: newDuel.betType,
        bet_xp: newDuel.betType !== 'coins' ? newDuel.betXp : 0,
        bet_coins: newDuel.betType !== 'xp' ? newDuel.betCoins : 0,
        reward_xp: rewards.xp,
        reward_coins: rewards.coins,
        status: 'pending',
        results: {},
        total_days: newDuel.totalDays,
        current_day: 1,
        scores: {},
      });
      if (error) { alert('Erro: ' + error.message); return; }
      setIsChallenging(false);
      setNewDuel({ opponentId: '', type: 'WOD', betType: 'xp', betXp: 20, betCoins: 10 });
      // Notifica o oponente
      const opponent = users.find(u => u.id === newDuel.opponentId);
      await createNotification(
        newDuel.opponentId,
        'duel_challenge',
        '⚔️ Você foi desafiado!',
        `${user.name} te desafiou para um duelo de ${newDuel.type}. Apostar: ${getBetLabel({ bet_type: newDuel.betType, bet_xp: newDuel.betXp, bet_coins: newDuel.betCoins })}`,
        { duel_type: newDuel.type, challenger_name: user.name }
      );
      alert('Desafio enviado! Aguarde o oponente aceitar.');
      fetchDuels();
    } finally { setLoading(false); }
  };

  /** Oponente aceita o duelo */
  const handleAccept = async (duelId: string) => {
    if (!user) return;
    const duel = duels.find(d => d.id === duelId);
    if (!duel) return;
    if ((duel.bet_type === 'xp' || duel.bet_type === 'both') && (user.xp || 0) < duel.bet_xp) {
      alert(`XP insuficiente! Você tem ${user.xp} XP.`); return;
    }
    if ((duel.bet_type === 'coins' || duel.bet_type === 'both') && (user.coins || 0) < duel.bet_coins) {
      alert(`BrazaCoins insuficientes! Você tem ${user.coins} BC.`); return;
    }
    setLoading(true);
    try {
      await supabase.from('duels').update({ status: 'accepted' }).eq('id', duelId);
      await createNotification(
        duel.challenger_id,
        'duel_accepted',
        '✅ Duelo aceito!',
        `${duel.opponentName} aceitou seu desafio de ${duel.type}! Boa sorte!`,
        { duel_id: duelId }
      );
      fetchDuels();
    } finally { setLoading(false); }
  };

  /** Qualquer participante cancela/recusa o duelo */
  const handleCancel = async (duelId: string) => {
    if (!user) return;
    const duel = duels.find(d => d.id === duelId);
    if (!duel) return;
    const isChallenger = duel.challenger_id === user.id;
    const isOpponent = duel.opponent_id === user.id;
    if (!isChallenger && !isOpponent) return;

    setLoading(true);
    try {
      await supabase.from('duels').update({ status: 'finished', winner_id: null }).eq('id', duelId);
      // Notifica o outro participante
      const otherId = isChallenger ? duel.opponent_id : duel.challenger_id;
      const otherName = isChallenger ? duel.opponentName : duel.challengerName;
      const myName = isChallenger ? duel.challengerName : duel.opponentName;
      await createNotification(
        otherId,
        'duel_canceled',
        isChallenger ? '❌ Duelo cancelado' : '❌ Duelo recusado',
        isChallenger
          ? `${myName} cancelou o duelo de ${duel.type}.`
          : `${myName} recusou o duelo de ${duel.type}.`,
        { duel_id: duelId }
      );
      fetchDuels(); fetchHistory();
    } finally { setLoading(false); }
  };

  const handleSubmitResult = async (duel: any) => {
    if (!user) return;
    const result = submissions[duel.id]?.trim();
    if (!result) { alert('Digite seu resultado.'); return; }

    const newResults = { ...(duel.results || {}), [user.id]: result };
    const participants = [duel.challenger_id, duel.opponent_id];
    const allSubmitted = participants.every(id => newResults[id]);
    const totalDays = duel.total_days || 1;
    const currentDay = duel.current_day || 1;

    setLoading(true);
    try {
      if (allSubmitted) {
        // Determina vencedor do dia
        const dayWinnerId = pickWinner(newResults as Record<string, string>, participants);

        // Acumula placar
        const newScores: Record<string, number> = { ...(duel.scores || {}) };
        if (dayWinnerId) {
          newScores[dayWinnerId] = (newScores[dayWinnerId] || 0) + 1;
        }

        const isDuelOver = currentDay >= totalDays;

        if (isDuelOver) {
          // Todos os dias completados — determina vencedor final pelo placar
          const finalWinnerId = participants.reduce((a, b) =>
            (newScores[a] || 0) >= (newScores[b] || 0) ? a : b
          );
          const finalLoserId = participants.find(id => id !== finalWinnerId) || '';

          await supabase.from('duels').update({
            results: newResults,
            scores: newScores,
            status: 'finished',
            winner_id: finalWinnerId,
          }).eq('id', duel.id);

          // Paga recompensa só agora
          await addReward(finalWinnerId, 'duel', duel.reward_xp || 40, duel.reward_coins || 0, `Vitória no duelo (${duel.type})`);
          if (finalLoserId) {
            const loseXp = duel.bet_xp > 0 ? -duel.bet_xp : 0;
            const loseCoins = duel.bet_coins > 0 ? -duel.bet_coins : 0;
            await addReward(finalLoserId, 'duel', loseXp, loseCoins, `Derrota no duelo (${duel.type})`);
          }

          const winnerName = finalWinnerId === duel.challenger_id ? duel.challengerName : duel.opponentName;
          await createNotification(finalWinnerId, 'duel_result', '🏆 Você venceu o duelo!',
            `Você derrotou ${finalWinnerId === duel.challenger_id ? duel.opponentName : duel.challengerName} no duelo de ${duel.type}! +${duel.reward_xp || 40} XP${duel.reward_coins ? ` e +${duel.reward_coins} BC` : ''}.`,
            { duel_id: duel.id });
          await createNotification(finalLoserId, 'duel_result', '💪 Duelo finalizado',
            `${winnerName} venceu o duelo de ${duel.type}. Continue treinando!`,
            { duel_id: duel.id });

          if (finalWinnerId === user.id) {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#fff'] });
            alert(`🏆 Você venceu o duelo! +${duel.reward_xp || 40} XP${duel.reward_coins ? ` e +${duel.reward_coins} BC` : ''}!`);
          } else {
            alert(`Duelo finalizado. ${winnerName} venceu.`);
          }

          const { data: prof } = await supabase.from('profiles').select('xp, coins, level').eq('id', user.id).maybeSingle();
          if (prof) updateUser({ ...user, xp: prof.xp, coins: prof.coins, level: prof.level });

        } else {
          // Dia completado mas ainda há mais dias — avança para o próximo
          const dayWinnerName = dayWinnerId === duel.challenger_id ? duel.challengerName : duel.opponentName;
          await supabase.from('duels').update({
            results: {},           // limpa resultados para o próximo dia
            scores: newScores,     // mantém placar acumulado
            current_day: currentDay + 1,
          }).eq('id', duel.id);

          const opponentId = user.id === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
          await createNotification(opponentId, 'duel_day', `📅 Dia ${currentDay} concluído!`,
            `${dayWinnerName} venceu o dia ${currentDay}. Placar: ${duel.challengerName} ${newScores[duel.challenger_id] || 0} x ${newScores[duel.opponent_id] || 0} ${duel.opponentName}. Envie o resultado do dia ${currentDay + 1}!`,
            { duel_id: duel.id });

          if (dayWinnerId === user.id) {
            alert(`✅ Dia ${currentDay} concluído! Você venceu esse dia.
Placar: ${duel.challengerName} ${newScores[duel.challenger_id] || 0} x ${newScores[duel.opponent_id] || 0} ${duel.opponentName}
Dia ${currentDay + 1}/${totalDays} começa agora!`);
          } else {
            alert(`✅ Dia ${currentDay} concluído! ${dayWinnerName} venceu esse dia.
Placar: ${duel.challengerName} ${newScores[duel.challenger_id] || 0} x ${newScores[duel.opponent_id] || 0} ${duel.opponentName}
Dia ${currentDay + 1}/${totalDays} começa agora!`);
          }
        }
      } else {
        // Só um enviou — salva parcial e notifica oponente
        await supabase.from('duels').update({ results: newResults }).eq('id', duel.id);
        const opponentId = user.id === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
        await createNotification(opponentId, 'duel_result', '⏳ Seu oponente enviou o resultado!',
          `${user.name} já enviou o resultado do dia ${currentDay}/${totalDays} do duelo de ${duel.type}. Envie o seu para continuar!`,
          { duel_id: duel.id });
        alert(`Resultado do dia ${currentDay}/${totalDays} enviado! Aguardando o oponente.`);
      }

      setSubmissions(prev => ({ ...prev, [duel.id]: '' }));
      fetchDuels(); fetchHistory();
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar resultado.');
    } finally { setLoading(false); }
  };

  const rewards = calcRewards();

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
              const participants = [duel.challenger_id, duel.opponent_id];
              const myResult = (duel.results || {})[user?.id || ''];
              const allSubmitted = participants.every(id => (duel.results || {})[id]);

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
                      <div key={p.id} className="flex flex-col items-center gap-2 flex-1">
                        {i === 1 && <span className="absolute text-on-surface-variant font-headline font-black text-2xl italic opacity-30">VS</span>}
                        <div className={`w-14 h-14 rounded-full border-2 border-${p.color} bg-surface-container-highest flex items-center justify-center font-headline font-black text-xl text-${p.color}`}>
                          {p.name?.[0] || '?'}
                        </div>
                        <span className="text-[10px] font-bold text-on-surface uppercase italic truncate max-w-[70px]">
                          {p.id === user?.id ? 'VOCÊ' : p.name?.split(' ')[0] || 'ATLETA'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-surface-container-highest/50 rounded-2xl p-4 grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</p>
                      <p className="text-xs font-headline font-black text-on-surface uppercase italic">{duel.type}</p>
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

                  {/* Progresso por dias (só mostra se for multi-dia) */}
                  {(duel.total_days || 1) > 1 && (
                    <div className="bg-surface-container-highest/30 rounded-2xl p-4 mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">
                          Dia {duel.current_day || 1} de {duel.total_days}
                        </p>
                        <p className="text-[9px] font-black text-on-surface uppercase">
                          {duel.challengerName?.split(' ')[0]} {(duel.scores || {})[duel.challenger_id] || 0}
                          {' '}×{' '}
                          {(duel.scores || {})[duel.opponent_id] || 0} {duel.opponentName?.split(' ')[0]}
                        </p>
                      </div>
                      {/* Barra de progresso dos dias */}
                      <div className="flex gap-1">
                        {Array.from({ length: duel.total_days }).map((_, i) => {
                          const dayNum = i + 1;
                          const isDone = dayNum < (duel.current_day || 1);
                          const isCurrent = dayNum === (duel.current_day || 1);
                          return (
                            <div key={i} className={cn(
                              "flex-1 h-1.5 rounded-full transition-all",
                              isDone ? "bg-primary" : isCurrent ? "bg-secondary animate-pulse" : "bg-surface-container-highest"
                            )} />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Results panel (expanded) */}
                  {isExpanded && duel.status === 'accepted' && (
                    <div className="mb-4 bg-surface-container-highest/30 rounded-2xl p-4 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Resultados</p>
                      {participants.map(pid => {
                        const name = pid === duel.challenger_id ? duel.challengerName : duel.opponentName;
                        const vis = getVisibleResult(duel, pid);
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

                  {/* Submit result */}
                  {duel.status === 'accepted' && !myResult && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Seu resultado (ex: 12:34 ou 15 rounds)"
                        value={submissions[duel.id] || ''}
                        onChange={e => setSubmissions(prev => ({ ...prev, [duel.id]: e.target.value }))}
                        className="flex-1 bg-surface-container-highest border-none rounded-2xl px-4 py-3 font-headline font-bold text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                      />
                      <button
                        onClick={() => handleSubmitResult(duel)}
                        disabled={loading || !submissions[duel.id]?.trim()}
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

                  {/* Oponente: aceitar ou recusar */}
                  {duel.status === 'pending' && duel.opponent_id === user?.id && (
                    <div className="flex gap-3 mt-2">
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
                  {/* Desafiante: aguardando + botão cancelar */}
                  {duel.status === 'pending' && duel.challenger_id === user?.id && (
                    <div className="flex flex-col gap-2 mt-2">
                      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                        Aguardando resposta do oponente...
                      </p>
                      <button onClick={() => handleCancel(duel.id)} disabled={loading}
                        className="w-full bg-surface-container-highest text-on-surface-variant py-2 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center justify-center gap-2 border border-outline-variant/20 hover:border-error/40 hover:text-error transition-all">
                        CANCELAR DESAFIO <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {/* Duelo ativo: botão cancelar para ambos */}
                  {duel.status === 'accepted' && (duel.challenger_id === user?.id || duel.opponent_id === user?.id) && (
                    <button onClick={() => handleCancel(duel.id)} disabled={loading}
                      className="w-full mt-1 bg-transparent text-on-surface-variant py-2 rounded-xl font-headline font-black text-[9px] uppercase italic flex items-center justify-center gap-1 border border-outline-variant/10 hover:border-error/30 hover:text-error transition-all">
                      CANCELAR DUELO <X className="w-3 h-3" />
                    </button>
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
                        {new Date(duel.created_at).toLocaleDateString('pt-BR')} • {duel.type}
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

      {/* Modal Novo Desafio */}
      <AnimatePresence>
        {isChallenging && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">DESAFIAR ATLETA</h3>
                <button onClick={() => setIsChallenging(false)} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Oponente</label>
                  <select value={newDuel.opponentId} onChange={e => setNewDuel({ ...newDuel, opponentId: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface">
                    <option value="">Selecione um atleta</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo de Duelo</label>
                  <select value={newDuel.type} onChange={e => setNewDuel({ ...newDuel, type: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface">
                    <option value="WOD">WOD do Dia</option>
                    <option value="BURPEES">Máximo de Burpees (1 min)</option>
                    <option value="ROW">Remo 500m</option>
                    <option value="BENCHMARK">Benchmark (Fran, Grace...)</option>
                    <option value="CUSTOM">Desafio Personalizado</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">O que apostar?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'xp', label: 'XP', icon: '⚡' },
                      { key: 'coins', label: 'BrazaCoins', icon: '🪙' },
                      { key: 'both', label: 'Ambos', icon: '🔥' },
                    ] as const).map(({ key, label, icon }) => (
                      <button key={key} onClick={() => setNewDuel({ ...newDuel, betType: key })}
                        className={cn("py-3 rounded-2xl font-headline font-black text-[10px] uppercase italic transition-all border",
                          newDuel.betType === key
                            ? "bg-secondary text-background border-secondary"
                            : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-secondary/50")}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {(newDuel.betType === 'xp' || newDuel.betType === 'both') && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                      <span>Quantidade de XP</span>
                      <span className="text-primary">Você tem: {user?.xp || 0} XP</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setNewDuel({ ...newDuel, betXp: Math.max(5, newDuel.betXp - 5) })}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                      <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">{newDuel.betXp} XP</div>
                      <button onClick={() => setNewDuel({ ...newDuel, betXp: Math.min(user?.xp || 0, newDuel.betXp + 5) })}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}

                {(newDuel.betType === 'coins' || newDuel.betType === 'both') && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                      <span>Quantidade de BrazaCoins</span>
                      <span className="text-secondary">Você tem: {user?.coins || 0} BC</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setNewDuel({ ...newDuel, betCoins: Math.max(5, newDuel.betCoins - 5) })}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                      <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">{newDuel.betCoins} BC</div>
                      <button onClick={() => setNewDuel({ ...newDuel, betCoins: Math.min(user?.coins || 0, newDuel.betCoins + 5) })}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}

                {/* Número de dias */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Duração do Duelo</label>
                  <div className="flex gap-2">
                    {[1, 3, 5, 7].map(d => (
                      <button key={d} onClick={() => setNewDuel({ ...newDuel, totalDays: d })}
                        className={cn("flex-1 py-3 rounded-2xl font-headline font-black text-sm transition-all border",
                          newDuel.totalDays === d
                            ? "bg-primary text-background border-primary"
                            : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-primary/50")}>
                        {d === 1 ? '1 dia' : `${d} dias`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-secondary/10 p-4 rounded-2xl border border-secondary/20 space-y-1">
                  <p className="text-[10px] text-secondary font-black uppercase tracking-widest">RESUMO DA APOSTA</p>
                  <p className="text-xs text-on-surface font-bold">
                    Você aposta: <span className="text-secondary font-black">{getBetLabel({ bet_type: newDuel.betType, bet_xp: newDuel.betXp, bet_coins: newDuel.betCoins })}</span>
                  </p>
                  <p className="text-xs text-on-surface font-bold">
                    Vencedor leva: <span className="text-primary font-black">
                      {rewards.xp > 0 && `+${rewards.xp} XP`}{rewards.xp > 0 && rewards.coins > 0 && ' + '}{rewards.coins > 0 && `+${rewards.coins} BC`}
                    </span>
                  </p>
                  <p className="text-[10px] text-on-surface-variant italic">Vencedor determinado automaticamente quando ambos enviarem o resultado</p>
                </div>

                <button onClick={handleCreateDuel} disabled={loading || !newDuel.opponentId}
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
