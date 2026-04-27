import { useState, useEffect } from 'react';
import { Swords, Zap, Timer, UserRound, ChevronRight, History, Plus, Trophy, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { Duel, User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

export default function Duels() {
  const { user, login } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isChallenging, setIsChallenging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDuel, setNewDuel] = useState({ opponentId: '', type: 'WOD' });

  const fetchDuels = async () => {
    const { data } = await supabase
      .from('duels')
      .select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)')
      .neq('status', 'finished');
    
    setDuels((data || []).map(d => ({
      ...d,
      challengerName: d.challenger?.name || 'Atleta',
      opponentName: d.opponent?.name || 'Atleta',
      reward: { xp: d.reward_xp, coins: d.reward_coins }
    })));
  };

  const fetchHistory = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('duels')
      .select('*, challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq('status', 'finished')
      .order('created_at', { ascending: false });
    
    setHistory((data || []).map(d => ({
      ...d,
      reward: { xp: d.reward_xp, coins: d.reward_coins }
    })));
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id)
      .eq('status', 'approved');
    setUsers(data || []);
  };

  useEffect(() => {
    fetchDuels();
    fetchHistory();
    fetchUsers();

    const channel = supabase.channel('duels_changes')
      .on('postgres_changes', { event: '*', table: 'duels' }, () => {
        fetchDuels();
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleCreateDuel = async () => {
    if (!user || !newDuel.opponentId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('duels')
        .insert({
          challenger_id: user.id,
          opponent_id: newDuel.opponentId,
          type: newDuel.type,
          reward_xp: 40,
          reward_coins: 10,
          status: 'pending'
        });

      if (!error) {
        setIsChallenging(false);
        alert('Desafio enviado!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (duelId: string, status: 'accepted' | 'rejected') => {
    setLoading(true);
    try {
      await supabase
        .from('duels')
        .update({ status })
        .eq('id', duelId);
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

      await supabase
        .from('duels')
        .update({ status: 'finished', winner_id: winnerId })
        .eq('id', duelId);

      const isWinner = user.id === winnerId;
      const xp = isWinner ? 40 : 15;
      const coins = isWinner ? 10 : 0;
      
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      
      await addReward(user.id, 'duel', xp, coins, isWinner ? "Vitória em duelo" : "Participação em duelo");
      
      // Also award the other participant
      const otherId = duel.challenger_id === user.id ? duel.opponent_id : duel.challenger_id;
      const otherIsWinner = otherId === winnerId;
      const otherXp = otherIsWinner ? 40 : 15;
      const otherCoins = otherIsWinner ? 10 : 0;
      await addReward(otherId, 'duel', otherXp, otherCoins, otherIsWinner ? "Vitória em duelo" : "Participação em duelo");

      alert(isWinner ? `Parabéns! Você venceu o duelo! +${xp} XP e +${coins} BrazaCoins!` : `Duelo finalizado! Você ganhou +${xp} XP pela participação.`);
      
      // Refresh user data locally
      const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (updatedProfile) {
        login(updatedProfile as User);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Swords className="w-8 h-8 text-secondary" />
          ARENA DE DUELOS
        </h1>
      </header>

      {/* New Challenge Button */}
      <button
        onClick={() => setIsChallenging(true)}
        className="w-full bg-secondary text-background py-5 rounded-2xl font-headline font-black text-lg shadow-[0_10px_30px_rgba(255,116,57,0.2)] hover:scale-[0.98] active:scale-95 transition-all uppercase italic tracking-tight flex items-center justify-center gap-2"
      >
        NOVO DESAFIO <Plus className="w-5 h-5 fill-current" />
      </button>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['active', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-secondary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab === 'active' ? 'ATIVOS' : 'HISTÓRICO'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-4"
          >
            {duels.filter(d => d.status !== 'finished').map((duel) => (
              <div key={duel.id} className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6">
                  <span className={cn(
                    "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                    duel.status === 'active' ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary/20 text-secondary border-secondary/30"
                  )}>
                    {duel.status === 'active' ? 'ATIVO' : 'PENDENTE'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-6">
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 rounded-full border-2 border-primary overflow-hidden bg-surface-container-highest flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <span className="text-[10px] font-bold text-on-surface uppercase italic">VOCÊ</span>
                  </div>

                  <div className="flex flex-col items-center gap-1 px-4">
                    <span className="text-on-surface-variant font-headline font-black text-2xl italic opacity-30">VS</span>
                    <div className="h-10 w-[1px] bg-outline-variant/20"></div>
                  </div>

                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 rounded-full border-2 border-secondary overflow-hidden bg-surface-container-highest flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <span className="text-[10px] font-bold text-on-surface uppercase italic">SARAH V.</span>
                  </div>
                </div>

                <div className="bg-surface-container-highest/50 rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</span>
                    <span className="text-xs font-headline font-black text-on-surface uppercase italic">{duel.type}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Recompensa</span>
                    <span className="text-xs font-headline font-black text-primary uppercase italic">+{duel.reward.xp} XP</span>
                  </div>
                </div>

                {duel.status === 'active' && (
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => handleFinish(duel.id, user?.id || '')}
                      disabled={loading}
                      className="flex-1 bg-primary text-background py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2"
                    >
                      EU VENCI <Trophy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleFinish(duel.id, duel.challengerId === user?.id ? duel.opponentId : duel.challengerId)}
                      disabled={loading}
                      className="flex-1 bg-surface-container-highest text-on-surface py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2"
                    >
                      EU PERDI <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {duel.status === 'pending' && duel.opponent_id === user?.id && (
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => handleRespond(duel.id, 'accepted')}
                      disabled={loading}
                      className="flex-1 bg-primary text-background py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2"
                    >
                      ACEITAR <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleRespond(duel.id, 'rejected')}
                      disabled={loading}
                      className="flex-1 bg-error-container text-on-error-container py-3 rounded-xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2"
                    >
                      REJEITAR <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-3"
          >
            {history.length > 0 ? history.map((duel) => {
              const isChallenger = duel.challenger_id === user?.id;
              const opponent = isChallenger ? duel.opponent : duel.challenger;
              const isWinner = duel.winner_id === user?.id;
              
              return (
                <div key={duel.id} className="bg-surface-container-low/50 p-5 rounded-3xl border border-outline-variant/10 flex items-center justify-between opacity-70">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      isWinner ? "bg-primary/20" : "bg-error-container/20"
                    )}>
                      {isWinner ? <Trophy className="w-5 h-5 text-primary" /> : <X className="w-5 h-5 text-error" />}
                    </div>
                    <div>
                      <p className="text-on-surface font-bold text-sm uppercase italic">
                        {isWinner ? 'Venceu' : 'Perdeu'} vs {opponent?.name || 'Atleta'}
                      </p>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                        {new Date(duel.created_at).toLocaleDateString('pt-BR')} • {duel.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-primary font-headline font-black text-xs">+{isWinner ? duel.reward.xp : 15} XP</p>
                    <p className="text-secondary font-headline font-black text-[10px]">+{isWinner ? duel.reward.coins : 0} BC</p>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
                <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum duelo finalizado</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Challenge Modal */}
      <AnimatePresence>
        {isChallenging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">DESAFIAR ATLETA</h3>
                <button onClick={() => setIsChallenging(false)} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Oponente</label>
                  <select 
                    value={newDuel.opponentId} 
                    onChange={e => setNewDuel({...newDuel, opponentId: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                  >
                    <option value="">Selecione um atleta</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo de Duelo</label>
                  <select 
                    value={newDuel.type} 
                    onChange={e => setNewDuel({...newDuel, type: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface"
                  >
                    <option value="WOD">WOD do Dia</option>
                    <option value="BURPEES">Máximo de Burpees (1 min)</option>
                    <option value="ROW">Remo 500m</option>
                    <option value="BENCHMARK">Benchmark (Fran, Grace, etc)</option>
                  </select>
                </div>
                
                <div className="bg-secondary/10 p-4 rounded-2xl border border-secondary/20">
                  <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">RECOMPENSA</p>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-tight">Vencedor ganha +40 XP e +10 BrazaCoins</p>
                </div>

                <button 
                  onClick={handleCreateDuel}
                  disabled={loading || !newDuel.opponentId}
                  className="w-full bg-secondary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg mt-4 disabled:opacity-50"
                >
                  ENVIAR DESAFIO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
