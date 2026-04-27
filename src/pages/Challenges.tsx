import { useState, useEffect, useRef } from 'react';
import { Zap, CheckCircle2, History, Trophy, Camera, X, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';
import { cn } from '../lib/utils';

export default function Challenges() {
  const { user, updateUser } = useAuth();
  const [challenges, setChallenges] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true);
    setChallenges(challengesData || []);
    if (user) {
      const { data: historyData } = await supabase.from('reward_history').select('*').eq('user_id', user.id).eq('type', 'challenge');
      setHistory(historyData || []);
      const { data: checkinsData } = await supabase.from('challenge_checkins').select('*').eq('user_id', user.id);
      setCheckins(checkinsData || []);
    }
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const handleDayOk = async (challenge: any) => {
    if (challenge.require_photo) { setPhotoModal(challenge); return; }
    submitDayOk(challenge, null);
  };

  const submitDayOk = async (challenge: any, photoUrl: string | null) => {
    setLoading(challenge.id);
    try {
      await supabase.from('challenge_checkins').insert({ user_id: user?.id, challenge_id: challenge.id, photo_url: photoUrl });
      const days = checkins.filter(c => c.challenge_id === challenge.id).length + 1;
      if (days >= (challenge.required_days || 1)) {
        await addReward(user?.id!, 'challenge', challenge.xp, challenge.coins, `Desafio: ${challenge.title}`, challenge.id);
        confetti({ particleCount: 150 });
        alert('Desafio Concluído!');
      } else {
        alert('OK do dia marcado!');
      }
      fetchData();
    } finally { setLoading(null); setPhotoModal(null); }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <h1 className="text-3xl font-headline font-black text-on-surface italic uppercase flex items-center gap-3">
        <Zap className="w-8 h-8 text-secondary" /> DESAFIOS
      </h1>

      <div className="flex bg-surface-container-low p-1 rounded-2xl">
        {['active', 'history'].map((t: any) => (
          <button key={t} onClick={() => setActiveTab(t)} className={cn("flex-1 py-3 rounded-xl font-bold text-[10px] uppercase", activeTab === t ? "bg-secondary text-background" : "text-on-surface-variant")}>
            {t === 'active' ? 'ATIVOS' : 'HISTÓRICO'}
          </button>
        ))}
      </div>

      {activeTab === 'active' && challenges.map(c => {
        const doneToday = checkins.some(ck => ck.challenge_id === c.id && ck.created_at?.startsWith(new Date().toISOString().split('T')[0]));
        return (
          <div key={c.id} className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10 relative">
            <h3 className="text-xl font-black uppercase italic mb-1">{c.title}</h3>
            <p className="text-sm text-on-surface-variant mb-4">{c.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-primary">+{c.xp} XP / +{c.coins} BC</span>
              <button onClick={() => handleDayOk(c)} disabled={doneToday || !!loading} className={cn("px-6 py-3 rounded-2xl font-black text-xs uppercase", doneToday ? "bg-primary/20 text-primary" : "bg-secondary text-background")}>
                {doneToday ? '✓ OK HOJE' : 'MARCAR OK'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
