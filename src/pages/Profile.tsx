import { useState, useEffect } from 'react';
import { User, Zap, Coins, Activity, Trophy, Settings, ChevronRight, Medal, Calendar, LogOut, Clock, History, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RewardEvent, PersonalRecord } from '../types';
import AvatarPreview from '../components/AvatarPreview';

import { supabase } from '../lib/supabase';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<RewardEvent[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [checkinCount, setCheckinCount] = useState(0);
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);
  const [newPr, setNewPr] = useState({ exercise: '', value: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    if (user?.id) {
      const fetchData = async () => {
        // Fetch History
        const { data: historyData } = await supabase
          .from('reward_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setHistory((historyData || []).map(h => ({
          ...h,
          createdAt: h.created_at
        })));

        // Fetch PRs
        const { data: prsData } = await supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        setPrs(prsData || []);

        // Fetch Checkin Count
        const { count } = await supabase
          .from('checkins')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setCheckinCount(count || 0);
      };
      fetchData();
    }
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddPr = async () => {
    if (!user || !newPr.exercise || !newPr.value) return;
    
    const { error } = await supabase
      .from('personal_records')
      .insert({
        user_id: user.id,
        exercise: newPr.exercise,
        value: newPr.value,
        date: newPr.date
      });

    if (!error) {
      const { data } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      setPrs(data || []);
      setIsPrModalOpen(false);
      setNewPr({ exercise: '', value: '', date: new Date().toISOString().split('T')[0] });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <User className="w-8 h-8 text-primary" />
          PERFIL
        </h1>
        <button onClick={handleLogout} className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-error-container hover:bg-error-container hover:text-on-error-container transition-all">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Profile Header Card */}
      <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6">
          <span className="bg-primary/20 text-primary text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/30">
            {user?.role === 'admin' ? 'ADMINISTRADOR' : user?.role === 'coach' ? 'COACH' : 'ALUNO'}
          </span>
        </div>
        
        <div className="flex items-center gap-6 mb-8">
          <div className="relative">
            <AvatarPreview equipped={user?.avatar.equipped!} size="lg" />
            <button 
              onClick={() => navigate('/avatar')}
              className="absolute -bottom-2 -right-2 bg-primary text-on-primary p-2 rounded-xl shadow-lg border-2 border-surface-container-low hover:scale-110 transition-transform"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h2 className="text-3xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none mb-2">{user?.name}</h2>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic">{user?.email}</p>
            <div className="flex items-center gap-2 mt-3">
              <div className="bg-primary/20 px-3 py-1 rounded-full border border-primary/30">
                <span className="text-primary text-[10px] font-black uppercase tracking-widest">NÍVEL {user?.level}</span>
              </div>
              <div className="bg-secondary/20 px-3 py-1 rounded-full border border-secondary/30">
                <span className="text-secondary text-[10px] font-black uppercase tracking-widest">ATLETA PRO</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex flex-col gap-1">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3 text-primary" /> PONTOS XP
            </span>
            <span className="text-2xl font-headline font-black text-on-surface italic">{user?.xp}</span>
          </div>
          <div className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex flex-col gap-1">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
              <Coins className="w-3 h-3 text-secondary" /> BRAZACOINS
            </span>
            <span className="text-2xl font-headline font-black text-on-surface italic">{user?.coins}</span>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { icon: Calendar, label: 'Check-ins', value: checkinCount },
          { icon: Activity, label: 'Recordes', value: prs.length },
          { icon: Trophy, label: 'Vitórias', value: '0' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex flex-col items-center gap-2">
            <stat.icon className="w-5 h-5 text-on-surface-variant opacity-50" />
            <span className="text-xl font-headline font-black text-on-surface italic">{stat.value}</span>
            <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* Benchmarks / PRs */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
            <Medal className="w-5 h-5 text-secondary" /> RECORDES PESSOAIS
          </h3>
          <button 
            onClick={() => setIsPrModalOpen(true)}
            className="text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> ADICIONAR
          </button>
        </div>
        
        <div className="space-y-3">
          {prs.length > 0 ? prs.map((pr) => (
            <div key={pr.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-surface-container-highest p-3 rounded-xl">
                  <Activity className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-on-surface font-bold uppercase text-sm italic">{pr.exercise}</p>
                  <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                    {new Date(pr.date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <span className="text-primary font-headline font-black text-lg italic">{pr.value}</span>
            </div>
          )) : (
            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhum recorde registrado</p>
            </div>
          )}
        </div>
      </section>

      {/* PR Modal */}
      <AnimatePresence>
        {isPrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic">NOVO RECORDE</h3>
                <button onClick={() => setIsPrModalOpen(false)} className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Exercício</label>
                  <input 
                    type="text" 
                    value={newPr.exercise} 
                    onChange={e => setNewPr({...newPr, exercise: e.target.value})}
                    placeholder="ex: Back Squat"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Resultado</label>
                  <input 
                    type="text" 
                    value={newPr.value} 
                    onChange={e => setNewPr({...newPr, value: e.target.value})}
                    placeholder="ex: 140kg ou 3:45"
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Data</label>
                  <input 
                    type="date" 
                    value={newPr.date} 
                    onChange={e => setNewPr({...newPr, date: e.target.value})}
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 font-headline font-bold text-on-surface" 
                  />
                </div>
                <button 
                  onClick={handleAddPr}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg mt-4"
                >
                  SALVAR RECORDE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reward History */}
      <section className="space-y-4 mb-8">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> HISTÓRICO DE RECOMPENSAS
          </h3>
        </div>
        
        <div className="space-y-3">
          {history.length > 0 ? history.map((event) => (
            <div key={event.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  event.type === 'level_up' ? "bg-primary/20" : 
                  event.type === 'weekly_bonus' ? "bg-secondary/20" : 
                  "bg-surface-container-highest"
                )}>
                  {event.type === 'checkin' ? <Calendar className="w-4 h-4 text-on-surface-variant" /> :
                   event.type === 'challenge' ? <Trophy className="w-4 h-4 text-on-surface-variant" /> :
                   event.type === 'duel' ? <Zap className="w-4 h-4 text-on-surface-variant" /> :
                   event.type === 'level_up' ? <Medal className="w-4 h-4 text-primary" /> :
                   <Medal className="w-4 h-4 text-secondary" />}
                </div>
                <div>
                  <p className="text-on-surface font-bold uppercase text-xs italic">{event.description}</p>
                  <p className="text-on-surface-variant text-[8px] font-bold uppercase tracking-widest">
                    {new Date(event.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                {event.xp > 0 && <span className="text-primary font-headline font-black text-sm italic">+{event.xp} XP</span>}
                {event.coins > 0 && <span className="text-secondary font-headline font-black text-sm italic">+{event.coins} BC</span>}
              </div>
            </div>
          )) : (
            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-50 italic">Nenhuma recompensa registrada</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
