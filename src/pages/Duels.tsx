import { useState, useEffect } from 'react';
import { Swords, Zap, UserRound, Plus, Trophy, X, Check, Coins } from 'lucide-react';
import { cn } from '../lib/utils';
import { Duel, User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

export default function Duels() {
  const { user, updateUser } = useAuth();
  const [duels, setDuels] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isChallenging, setIsChallenging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDuel, setNewDuel] = useState({
    opponentId: '',
    type: 'WOD',
    betType: 'xp' as 'xp' | 'coins' | 'both',
    betXp: 20,
    betCoins: 10,
  });

  const fetchDuels = async () => {
    const { data } = await supabase
      .from('duels')
      .select('*, challenger:profiles!challenger_id(name, xp, coins), opponent:profiles!opponent_id(name, xp, coins)')
      .in('status', ['pending', 'accepted'])
      .or(`challenger_id.eq.${user?.id},opponent_id.eq.${user?.id}`);
    setDuels((data || []).map(d => ({
      ...d,
      challengerName: d.challenger?.name || 'Atleta',
      opponentName: d.opponent?.name || 'Atleta',
      reward: { xp: d.reward_xp || 0, coins: d.reward_coins || 0 }
    })));
  };

  const fetchHistory = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('duels')
      .select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)')
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data || []).map(d => ({
      ...d,
      reward: { xp: d.reward_xp || 0, coins: d.reward_coins || 0 }
    })));
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id)
      .eq('status', 'approved');
    setUsers((data || []).map((u: any) => ({
      ...u,
      avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory || [] },
      checkins: [], paidBonuses: u.paid_bonuses || []
    })));
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchDuels(); fetchHistory(); fetchUsers();
    const channel = supabase.channel('duels_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => {
        fetchDuels(); fetchHistory();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Calcula recompensas baseado na aposta
  const calcRewards = () => {
    const { betType, betXp, betCoins } = newDuel;
    if (betType === 'xp') return { xp: betXp * 2, coins: 0 };
    if (betType === 'coins') return { xp: 0, coins: betCoins * 2 };
    return { xp: betXp * 2, coins: betCoins * 2 };
  };

  const handleCreateDuel = async () => {
    if (!user || !newDuel.opponentId) return;

    // Verifica se tem saldo suficiente para apostar
    if (newDuel.betType === 'xp' || newDuel.betType === 'both') {
      if ((user.xp || 0) < newDuel.betXp) {
        alert(`Você não tem XP suficiente! Você tem ${user.xp} XP.`);
        return;
      }
    }
    if (newDuel.betType === 'coins' || newDuel.betType === 'both') {
      if ((user.coins || 0) < newDuel.betCoins) {
        alert(`Você não tem BrazaCoins suficientes! Você tem ${user.coins} BrazaCoins.`);
        return;
      }
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
        status: 'pending'
      });
      if (error) { alert('Erro ao criar duelo: ' + error.message); return; }
      setIsChallenging(false);
      setNewDuel({ opponentId: '', type: 'WOD', betType: 'xp', betXp: 20, betCoins: 10 });
      alert('Desafio enviado! Aguarde o oponente aceitar.');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (duelId: string, status: 'accepted' | 'rejected') => {
    if (status === 'accepted') {
      // Verifica saldo do oponente ao aceitar
      const duel = duels.find(d => d.id === duelId);
      if (duel) {
        if ((duel.bet_type === 'xp' || duel.bet_type === 'both') && (user?.xp || 0) < duel.bet_xp) {
          alert(`Você não tem XP suficiente para aceitar! Você tem ${user?.xp} XP, precisa de ${duel.bet_xp} XP.`);
          return;
        }
        if ((duel.bet_type === 'coins' || duel.bet_type === 'both') && (user?.coins || 0) < duel.bet_coins) {
          alert(`Você não tem BrazaCoins suficientes! Você tem ${user?.coins} BrazaCoins, precisa de ${duel.bet_coins}.`);
          return;
        }
      }
    }
    setLoading(true);
    try {
      await supabase.from('duels').update({ status }).eq('id', duelId);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (duelId: string, winnerId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
      if (!duel) return;
      if (duel.status === 'finished') {
        alert('Este duelo já foi finalizado.');
        return;
      }

      await supabase.from('duels').update({ status: 'finished', winner_id: winnerId }).eq('id', duelId);

      const isWinner = user.id === winnerId;
      const loserId = duel.challenger_id === winnerId ? duel.opponent_id : duel.challenger_id;

      // Vencedor recebe o dobro apostado
      const winXp = duel.reward_xp || 40;
      const winCoins = duel.reward_coins || 10;

      // Perdedor perde o que apostou (XP mínimo de 5 para não zerar)
      const loseXp = duel.bet_xp > 0 ? -duel.bet_xp : 0;
      const loseCoins = duel.bet_coins > 0 ? -duel.bet_coins : 0;

      if (isWinner) {
        await addReward(user.id, 'duel', winXp, winCoins, `Vitória no duelo vs ${duel.opponent_id === user.id ? 'oponente' : 'desafiante'}`);
        await addReward(loserId, 'duel', loseXp, loseCoins, 'Derrota no duelo — aposta perdida');
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#fff'] });
        alert(`🏆 Parabéns! Você venceu! +${winXp} XP e +${winCoins} BrazaCoins!`);
      } else {
        await addReward(loserId, 'duel', winXp, winCoins, 'Vitória no duelo');
        await addReward(user.id, 'duel', loseXp, loseCoins, 'Derrota no duelo — aposta perdida');
        alert(`Duelo finalizado. Você perdeu${loseXp < 0 ? ` ${loseXp} XP` : ''}${loseCoins < 0 ? ` e ${loseCoins} BrazaCoins` : ''}.`);
      }

      // Refresh profile
      const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (updatedProfile) {
        updateUser({
          ...user,
          xp: updatedProfile.xp,
          coins: updatedProfile.coins,
          level: updatedProfile.level
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getBetLabel = (duel: any) => {
    if (!duel.bet_type || duel.bet_type === 'xp') return `${duel.bet_xp || 0} XP`;
    if (duel.bet_type === 'coins') return `${duel.bet_coins} BrazaCoins`;
    return `${duel.bet_xp} XP + ${duel.bet_coins} BC`;
  };

  const getRewardLabel = (duel: any) => {
    const xp = duel.reward_xp || 0;
    const coins = duel.reward_coins || 0;
    if (xp > 0 && coins > 0) return `+${xp} XP + ${coins} BC`;
    if (xp > 0) return `+${xp} XP`;
    return `+${coins} BC`;
  };

  const rewards = calcRewards();

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Swords className="w-8 h-8 text-secondary" /> ARENA DE DUELOS
        </h1>
        {/* Saldo */}
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

      <button
        onClick={() => setIsChallenging(true)}
        className="w-full bg-secondary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(255,116,57,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2"
      >
        NOVO DESAFIO <Plus className="w-5 h-5 fill-current" />
      </button>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['active', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-secondary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >{tab === 'active' ? 'ATIVOS' : 'HISTÓRICO'}</button>
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
            {duels.map(duel => (
              <div key={duel.id} className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 relative overflow-hidden">
                {/* Status badge */}
                <div className="absolute top-4 right-4">
                  <span className={cn(
                    "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                    duel.status === 'accepted' ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary/20 text-secondary border-secondary/30"
                  )}>
                    {duel.status === 'accepted' ? 'ATIVO' : 'PENDENTE'}
                  </span>
                </div>

                {/* VS */}
                <div className="flex justify-between items-center mb-5 mt-2">
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 rounded-full border-2 border-primary bg-surface-container-highest flex items-center justify-center font-headline font-black text-xl text-primary">
                      {duel.challengerName[0]}
                    </div>
                    <span className="text-[10px] font-bold text-on-surface uppercase italic truncate max-w-[70px]">
                      {duel.challenger_id === user?.id ? 'VOCÊ' : duel.challengerName.split(' ')[0]}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 px-2">
                    <span className="text-on-surface-variant font-headline font-black text-2xl italic opacity-30">VS</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 rounded-full border-2 border-secondary bg-surface-container-highest flex items-center justify-center font-headline font-black text-xl text-secondary">
                      {duel.opponentName[0]}
                    </div>
                    <span className="text-[10px] font-bold text-on-surface uppercase italic truncate max-w-[70px]">
                      {duel.opponent_id === user?.id ? 'VOCÊ' : duel.opponentName.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="bg-surface-container-highest/50 rounded-2xl p-4 grid grid-cols-3 gap-2 mb-4">
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

                {/* Actions */}
                {duel.status === 'accepted' && (
                  <div className="flex gap-3">
                    <button onClick={() => handleFinish(duel.id, user?.id || '')} disabled={loading}
                      className="flex-1 bg-primary text-background py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                      EU VENCI <Trophy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleFinish(duel.id, duel.challenger_id === user?.id ? duel.opponent_id : duel.challenger_id)} disabled={loading}
                      className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2">
                      EU PERDI <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {duel.status === 'pending' && duel.opponent_id === user?.id && (
                  <div className="flex gap-3">
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
                {duel.status === 'pending' && duel.challenger_id === user?.id && (
                  <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Aguardando resposta do oponente...</p>
                )}
              </div>
            ))}
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
                        {new Date(duel.created_at).toLocaleDateString('pt-BR')} • {duel.type} • apostou {getBetLabel(duel)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-headline font-black text-xs", isWinner ? "text-primary" : "text-error")}>
                      {isWinner ? `+${duel.reward_xp} XP` : `-${duel.bet_xp || 0} XP`}
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
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">DESAFIAR ATLETA</h3>
                <button onClick={() => setIsChallenging(false)} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Oponente */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Oponente</label>
                  <select value={newDuel.opponentId} onChange={e => setNewDuel({...newDuel, opponentId: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface">
                    <option value="">Selecione um atleta</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                {/* Tipo de duelo */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo de Duelo</label>
                  <select value={newDuel.type} onChange={e => setNewDuel({...newDuel, type: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface">
                    <option value="WOD">WOD do Dia</option>
                    <option value="BURPEES">Máximo de Burpees (1 min)</option>
                    <option value="ROW">Remo 500m</option>
                    <option value="BENCHMARK">Benchmark (Fran, Grace...)</option>
                    <option value="CUSTOM">Desafio Personalizado</option>
                  </select>
                </div>

                {/* Tipo de aposta */}
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">O que apostar?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'xp', label: 'XP', icon: '⚡' },
                      { key: 'coins', label: 'BrazaCoins', icon: '🪙' },
                      { key: 'both', label: 'Ambos', icon: '🔥' },
                    ] as const).map(({ key, label, icon }) => (
                      <button key={key} onClick={() => setNewDuel({...newDuel, betType: key})}
                        className={cn(
                          "py-3 rounded-2xl font-headline font-black text-[10px] uppercase italic transition-all border",
                          newDuel.betType === key
                            ? "bg-secondary text-background border-secondary"
                            : "bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:border-secondary/50"
                        )}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor da aposta XP */}
                {(newDuel.betType === 'xp' || newDuel.betType === 'both') && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                      <span>Quantidade de XP</span>
                      <span className="text-primary">Você tem: {user?.xp || 0} XP</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setNewDuel({...newDuel, betXp: Math.max(5, newDuel.betXp - 5)})}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                      <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">
                        {newDuel.betXp} XP
                      </div>
                      <button onClick={() => setNewDuel({...newDuel, betXp: Math.min(user?.xp || 0, newDuel.betXp + 5)})}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}

                {/* Valor da aposta Coins */}
                {(newDuel.betType === 'coins' || newDuel.betType === 'both') && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex justify-between">
                      <span>Quantidade de BrazaCoins</span>
                      <span className="text-secondary">Você tem: {user?.coins || 0} BC</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setNewDuel({...newDuel, betCoins: Math.max(5, newDuel.betCoins - 5)})}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">−</button>
                      <div className="flex-1 bg-surface-container-highest rounded-2xl p-3 text-center font-headline font-black text-on-surface text-lg">
                        {newDuel.betCoins} BC
                      </div>
                      <button onClick={() => setNewDuel({...newDuel, betCoins: Math.min(user?.coins || 0, newDuel.betCoins + 5)})}
                        className="w-10 h-10 rounded-xl bg-surface-container-highest font-black text-lg text-on-surface flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}

                {/* Resumo da aposta */}
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
                  <p className="text-[10px] text-on-surface-variant italic">O perdedor perde o valor apostado</p>
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
