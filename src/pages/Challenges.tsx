import { useState, useEffect } from 'react';
import { Zap, Coins, Timer, ChevronRight, CheckCircle2, History, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { Challenge, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

export default function Challenges() {
  const { user, updateUser } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    // Fetch Challenges
    const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true);
    if (challengesData) setChallenges(challengesData);
    
    if (user) {
      // Fetch History
      const { data: historyData } = await supabase
        .from('reward_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'challenge')
        .order('created_at', { ascending: false });
      
      if (historyData) setHistory(historyData);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const handleComplete = async (challengeId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const challenge = challenges.find(c => c.id === challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');

      // Check if already completed (if not repeatable)
      if (!challenge.repeatable) {
        const alreadyDone = history.some(h => h.challenge_id === challengeId);
        if (alreadyDone) {
          alert('Você já concluiu este desafio!');
          setLoading(false);
          return;
        }
      } else {
        // Check daily limit
        const today = new Date().toISOString().split('T')[0];
        const todayCompletions = history.filter(h => h.challenge_id === challengeId && h.created_at.startsWith(today));
        if (todayCompletions.length >= (challenge.dailyLimit || 1)) {
          alert('Você já atingiu o limite diário para este desafio!');
          setLoading(false);
          return;
        }
      }

      // Add Reward
      const rewardResult = await addReward(user.id, 'challenge', challenge.xp, challenge.coins, `Desafio: ${challenge.title}`, challengeId);
      
      if (rewardResult) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        if (rewardResult.levelUp) {
          setTimeout(() => {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] });
          }, 500);
        }

        // Refresh user profile
        const { data: updatedProfile } = await supabase.from('profiles').select('*, checkins(*)').eq('id', user.id).single();
        if (updatedProfile) {
          const mappedUser: User = {
            ...updatedProfile,
            avatar: {
              equipped: updatedProfile.avatar_equipped,
              inventory: updatedProfile.avatar_inventory
            },
            checkins: updatedProfile.checkins || [],
            paidBonuses: updatedProfile.paid_bonuses || []
          };
          updateUser(mappedUser);
        }
        
        alert(`Desafio concluído! +${challenge.xp} XP e +${challenge.coins} BrazaCoins!`);
        fetchData(); // Refresh history
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao concluir desafio: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Zap className="w-8 h-8 text-secondary" />
          DESAFIOS
        </h1>
      </header>

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
            {challenges.filter(c => c.active).map((challenge) => (
              <div key={challenge.id} className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 flex gap-2">
                  <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary/30">+{challenge.xp} XP</span>
                  <span className="bg-secondary/20 text-secondary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-secondary/30">+{challenge.coins} C</span>
                </div>
                
                <div className="flex flex-col gap-4">
                  <div className="bg-secondary/20 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trophy className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-headline font-black text-on-surface uppercase italic tracking-tighter leading-none mb-2">{challenge.title}</h3>
                    <p className="text-on-surface-variant text-sm font-medium leading-tight opacity-80">{challenge.description}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-on-surface-variant" />
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                      {challenge.repeatable ? `Limite Diário: ${challenge.dailyLimit}` : 'Apenas uma vez'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleComplete(challenge.id)}
                    disabled={loading}
                    className="text-secondary text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:translate-x-1 transition-transform disabled:opacity-50"
                  >
                    {loading ? 'PROCESSANDO...' : 'RESGATAR RECOMPENSA'} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
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
            {history.length > 0 ? history.map((h) => (
              <div key={h.id} className="bg-surface-container-low/50 p-5 rounded-3xl border border-outline-variant/10 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-on-surface font-bold text-sm uppercase italic">{h.description}</p>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                      {new Date(h.created_at).toLocaleDateString('pt-BR')} • {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-primary font-headline font-black text-xs">+{h.xp} XP</p>
                  <p className="text-secondary font-headline font-black text-[10px]">+{h.coins} C</p>
                </div>
              </div>
            )) : (
              <div className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 text-center flex flex-col items-center gap-4">
                <History className="w-12 h-12 text-on-surface-variant opacity-20" />
                <p className="text-on-surface-variant font-headline font-bold uppercase italic tracking-widest">Nenhum histórico encontrado</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
