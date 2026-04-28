import { useState, useEffect } from 'react';
import { Zap, CheckCircle2, History, Trophy, Camera, Upload } from 'lucide-react';
import { Challenge, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

export default function Challenges() {
  const { user, updateUser } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    const { data } = await supabase.from('challenges').select('*').eq('active', true);
    if (data) setChallenges(data);
    const { data: hist } = await supabase.from('reward_history').select('*').eq('user_id', user?.id).eq('type', 'challenge');
    setHistory(hist || []);
  };

  const handleComplete = async (challenge: Challenge) => {
    if (loading) return;
    setLoading(true);
    try {
      // Registrar no histórico e dar XP/Coins
      await addReward(user?.id!, 'challenge', challenge.xp, challenge.coins, `Desafio: ${challenge.title}`, challenge.id);
      
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      alert('Desafio concluído!');
      fetchData();
    } catch (e) {
      alert('Erro ao registrar desafio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen">
      <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
        <Zap className="w-8 h-8 text-secondary" /> DESAFIOS
      </h1>

      <div className="flex flex-col gap-4">
        {challenges.map(challenge => (
          <motion.div key={challenge.id} className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-primary font-black">+{challenge.xp} XP</p>
                <p className="text-secondary font-black">+{challenge.coins} BC</p>
              </div>
            </div>
            <h3 className="text-2xl font-headline font-black uppercase italic tracking-tighter mb-2">{challenge.title}</h3>
            <p className="text-on-surface-variant text-sm mb-6">{challenge.description}</p>
            
            <button 
              onClick={() => handleComplete(challenge)}
              disabled={history.some(h => h.challenge_id === challenge.id)}
              className="w-full py-4 bg-secondary text-background rounded-2xl font-headline font-black uppercase italic disabled:opacity-50"
            >
              {history.some(h => h.challenge_id === challenge.id) ? 'DESAFIO CONCLUÍDO ✓' : 'MARCAR COMO FEITO'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
