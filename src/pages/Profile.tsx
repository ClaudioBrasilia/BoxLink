import { useState, useEffect } from 'react';
import { User, Zap, Coins, Activity, Trophy, Settings, ChevronRight, Medal, Calendar, LogOut, Clock, History, Plus, X, Award, Download, Share2, Edit2, Save, CalendarCheck, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RewardEvent, PersonalRecord, Item } from '../types';
import AvatarPreview from '../components/AvatarPreview';

import { supabase } from '../lib/supabase';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<RewardEvent[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [checkinCount, setCheckinCount] = useState(0);
  const [checkinDates, setCheckinDates] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);
  const [newPr, setNewPr] = useState({ exercise: '', value: '', date: new Date().toISOString().split('T')[0] });
  const [selectedAchievement, setSelectedAchievement] = useState<any | null>(null);
  const [duelsWon, setDuelsWon] = useState(0);
  const [duelsTotal, setDuelsTotal] = useState(0);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [sharing, setSharing] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    if (user?.id) {
      const fetchData = async () => {
        // Fetch Duels stats
        const { data: duelsData } = await supabase
          .from('duels')
          .select('winner_id')
          .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
          .eq('status', 'finished');
        setDuelsTotal((duelsData || []).length);
        setDuelsWon((duelsData || []).filter((d: any) => d.winner_id === user.id).length);

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

        // Fetch Checkin dates
        const { data: checkinsData, count } = await supabase
          .from('checkins')
          .select('date', { count: 'exact' })
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        setCheckinCount(count || 0);
        setCheckinDates((checkinsData || []).map((c: any) => c.date));

        // Fetch store items (needed to render avatar with equipped clothes)
        const { data: itemsData } = await supabase.from('items').select('*');
        setItems(itemsData || []);
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

  const handleSaveProfile = async () => {
    if (!editName.trim() || !user) return;
    const { error } = await supabase.from('profiles').update({ name: editName.trim() }).eq('id', user.id);
    if (!error) { updateUser({ ...user, name: editName.trim() }); setIsEditingProfile(false); }
    else alert('Erro ao salvar: ' + error.message);
  };


  const handleShareAchievement = async (achievement: any) => {
    setSharing(true);
    try {
      const canvas = document.createElement('canvas');
      // Square 1080x1080 — ideal for Instagram/WhatsApp
      canvas.width = 1080; canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Dark background
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, '#0a0a0a');
      grad.addColorStop(0.5, '#111111');
      grad.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1080);

      // Glow circle behind icon
      const glow = ctx.createRadialGradient(540, 400, 0, 540, 400, 300);
      glow.addColorStop(0, 'rgba(202,253,0,0.15)');
      glow.addColorStop(1, 'rgba(202,253,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1080, 1080);

      // Decorative grid lines
      ctx.strokeStyle = 'rgba(202,253,0,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 1080; i += 80) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1080); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1080, i); ctx.stroke();
      }

      // Outer border
      ctx.strokeStyle = 'rgba(202,253,0,0.5)';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 1040, 1040);

      // Inner border
      ctx.strokeStyle = 'rgba(202,253,0,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, 1010, 1010);

      // BOXLINK label top
      ctx.fillStyle = 'rgba(202,253,0,0.6)';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('BOXLINK', 540, 90);

      // Achievement icon (emoji)
      ctx.font = '220px serif';
      ctx.textAlign = 'center';
      ctx.fillText(achievement.icon, 540, 420);

      // Achievement name
      ctx.fillStyle = '#CAFD00';
      ctx.font = 'bold 72px Arial';
      ctx.fillText(achievement.name.toUpperCase(), 540, 530);

      // Description
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '38px Arial';
      ctx.fillText(achievement.description, 540, 600);

      // Separator
      ctx.strokeStyle = 'rgba(202,253,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(240, 650); ctx.lineTo(840, 650); ctx.stroke();

      // "CONQUISTADO POR" label
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '26px Arial';
      ctx.letterSpacing = '0.3em';
      ctx.fillText('CONQUISTADO POR', 540, 710);

      // Athlete name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 60px Arial';
      ctx.fillText((user?.name || '').toUpperCase(), 540, 790);

      // Level
      ctx.fillStyle = 'rgba(202,253,0,0.7)';
      ctx.font = 'bold 34px Arial';
      ctx.fillText(`NÍVEL ${user?.level || 1}`, 540, 850);

      // Bottom branding
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '24px Arial';
      ctx.fillText('boxlink.vercel.app', 540, 1030);

      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 1.0));
      if (!blob) return;

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'conquista.png')] })) {
        await navigator.share({
          title: `${achievement.name} — BoxLink`,
          text: `Desbloqueei a conquista "${achievement.name}" no BoxLink! 💪`,
          files: [new File([blob], 'conquista.png', { type: 'image/png' })],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `conquista-${achievement.id}.png`; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error(e); }
    finally { setSharing(false); }
  };

  // Calculate achievements dynamically
  const achievements = [
    { id: 'first_checkin',  name: 'Primeiro Passo',    description: 'Faça seu primeiro check-in',    icon: '👣', category: 'consistency', unlocked: checkinCount >= 1 },
    { id: 'week_warrior',   name: 'Guerreiro Semanal',  description: '7 check-ins no total',           icon: '📅', category: 'consistency', unlocked: checkinCount >= 7 },
    { id: 'iron_habit',     name: 'Hábito de Ferro',    description: '30 check-ins no total',          icon: '🔗', category: 'consistency', unlocked: checkinCount >= 30 },
    { id: 'century',        name: 'Centenário',         description: '100 check-ins no total',         icon: '💯', category: 'consistency', unlocked: checkinCount >= 100 },
    { id: 'first_pr',       name: 'PR Hunter',          description: 'Registre seu primeiro PR',       icon: '🎯', category: 'performance', unlocked: prs.length >= 1 },
    { id: 'pr_collector',   name: 'Colecionador',       description: 'Registre 5 PRs',                 icon: '📊', category: 'performance', unlocked: prs.length >= 5 },
    { id: 'level_5',        name: 'Escalada',           description: 'Alcance nível 5',                icon: '⬆️', category: 'performance', unlocked: (user?.level || 0) >= 5 },
    { id: 'level_10',       name: 'Elite',              description: 'Alcance nível 10',               icon: '⚡', category: 'performance', unlocked: (user?.level || 0) >= 10 },
    { id: 'xp_500',         name: 'Acumulador',         description: 'Acumule 500 XP',                 icon: '💫', category: 'performance', unlocked: (user?.xp || 0) >= 500 },
    { id: 'xp_2000',        name: 'XP Mestre',          description: 'Acumule 2000 XP',                icon: '🌟', category: 'performance', unlocked: (user?.xp || 0) >= 2000 },
    { id: 'first_duel',     name: 'Desafiante',         description: 'Participe do primeiro duelo',    icon: '⚔️', category: 'social',       unlocked: duelsTotal >= 1 },
    { id: 'duel_5',         name: 'Gladiador',          description: 'Participe de 5 duelos',          icon: '🛡️', category: 'social',       unlocked: duelsTotal >= 5 },
    { id: 'first_win',      name: 'Primeira Vitória',   description: 'Vença seu primeiro duelo',       icon: '🏅', category: 'social',       unlocked: duelsWon >= 1 },
    { id: 'win_5',          name: 'Dominante',          description: 'Vença 5 duelos',                 icon: '👑', category: 'social',       unlocked: duelsWon >= 5 },
    { id: 'win_10',         name: 'Lenda',              description: 'Vença 10 duelos',                icon: '🏆', category: 'social',       unlocked: duelsWon >= 10 },
  ];
  const unlockedCount = achievements.filter(a => a.unlocked).length;

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
          <div className="relative w-24 h-24 rounded-full border-2 border-primary shadow-[0_0_20px_rgba(202,253,0,0.5)] bg-surface-container-highest overflow-hidden shrink-0">
            <AvatarPreview equipped={user?.avatar.equipped ?? {} as any} items={items} size="lg" />
            <button 
              onClick={() => navigate('/avatar')}
              className="absolute -bottom-2 -right-2 bg-primary text-on-primary p-2 rounded-xl shadow-lg border-2 border-surface-container-low hover:scale-110 transition-transform"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <div>
            {isEditingProfile ? (
              <div className="flex gap-2 items-center mb-2">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="bg-surface-container-highest border border-primary/30 rounded-xl px-3 py-1 font-headline font-black text-on-surface text-lg uppercase italic outline-none flex-1" autoFocus />
                <button onClick={handleSaveProfile} className="p-2 bg-primary rounded-xl text-background"><Save className="w-4 h-4" /></button>
                <button onClick={() => setIsEditingProfile(false)} className="p-2 bg-surface-container-highest rounded-xl"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-3xl font-headline font-black text-on-surface italic uppercase tracking-tighter leading-none">{user?.name}</h2>
                <button onClick={() => { setEditName(user?.name || ''); setIsEditingProfile(true); }}
                  className="p-1.5 bg-primary/20 rounded-lg text-primary hover:bg-primary hover:text-background transition-all">
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
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
        <button
          onClick={() => setHistoryExpanded(prev => !prev)}
          className="flex justify-between items-center px-2 w-full"
        >
          <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> HISTÓRICO DE RECOMPENSAS
            {history.length > 0 && (
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                {history.length}
              </span>
            )}
          </h3>
          <ChevronRight className={`w-5 h-5 text-on-surface-variant transition-transform duration-300 ${historyExpanded ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {historyExpanded && (
            <motion.div
              key="history-list"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ===== CALENDÁRIO DE CHECK-INS ===== */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-headline font-black text-on-surface uppercase italic flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" /> HISTÓRICO DE TREINOS
          </h2>
        </div>

        {/* Month navigator */}
        <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-2 hover:bg-surface-container-highest rounded-xl transition-all">
              <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
            </button>
            <p className="font-headline font-black text-on-surface uppercase italic text-base capitalize">
              {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-2 hover:bg-surface-container-highest rounded-xl transition-all"
              disabled={calendarMonth.getMonth() === new Date().getMonth() && calendarMonth.getFullYear() === new Date().getFullYear()}>
              <ChevronRight className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1">
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[9px] font-black text-on-surface-variant uppercase tracking-widest py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {(() => {
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();
            const cells = [];

            // Empty cells before first day
            for (let i = 0; i < firstDay; i++) {
              cells.push(<div key={`e${i}`} />);
            }

            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isCheckin = checkinDates.includes(dateStr);
              const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
              const isFuture = new Date(year, month, d) > today;

              cells.push(
                <div key={d} className={`aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                  isCheckin
                    ? 'bg-primary text-background shadow-[0_0_10px_rgba(202,253,0,0.4)]'
                    : isToday
                      ? 'bg-outline-variant/20 text-primary border border-primary/40'
                      : isFuture
                        ? 'text-on-surface-variant/20'
                        : 'text-on-surface-variant/40'
                }`}>
                  {d}
                </div>
              );
            }

            return <div className="grid grid-cols-7 gap-1">{cells}</div>;
          })()}

          {/* Monthly summary */}
          {(() => {
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const monthCheckins = checkinDates.filter(d => d.startsWith(monthStr)).length;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const pct = Math.round((monthCheckins / daysInMonth) * 100);
            return (
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                  {monthCheckins} treino{monthCheckins !== 1 ? 's' : ''} este mês
                </p>
                <p className="text-[10px] text-primary font-black uppercase">
                  {pct}% de frequência
                </p>
              </div>
            );
          })()}
        </div>

        {/* Monthly history list */}
        {(() => {
          const monthMap: Record<string, number> = {};
          checkinDates.forEach(d => {
            const key = d.slice(0, 7);
            monthMap[key] = (monthMap[key] || 0) + 1;
          });
          const months = Object.entries(monthMap)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 6)
            .map(([key, total]) => {
              const [y, m] = key.split('-').map(Number);
              const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              return { key, label, total };
            });
          if (months.length === 0) return null;
          return (
            <div className="flex flex-col gap-2">
              {months.map(m => (
                <div key={m.key} className="flex items-center justify-between bg-surface-container-low rounded-2xl border border-outline-variant/10 px-4 py-3">
                  <p className="text-sm font-bold text-on-surface uppercase italic capitalize">{m.label}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (m.total / 26) * 100)}%` }} />
                    </div>
                    <span className="text-primary text-xs font-black">{m.total}x</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* ===== CONQUISTAS ===== */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-headline font-black text-on-surface uppercase italic flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" /> CONQUISTAS
          </h2>
          <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            {unlockedCount}/{achievements.length} desbloqueadas
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {achievements.map(a => (
            <button key={a.id}
              onClick={() => a.unlocked && setSelectedAchievement(a)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                a.unlocked
                  ? 'bg-surface-container-low border-primary/20 hover:border-primary hover:scale-105 active:scale-95'
                  : 'bg-surface-container-low/30 border-outline-variant/5 opacity-25 cursor-not-allowed'
              }`}>
              <span className="text-3xl">{a.unlocked ? a.icon : '🔒'}</span>
              <p className={`text-[9px] font-black uppercase italic text-center leading-tight ${a.unlocked ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {a.name}
              </p>
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-widest italic">
          Toque em uma conquista desbloqueada para compartilhar
        </p>
      </section>

      {/* Modal conquista */}
      <AnimatePresence>
        {selectedAchievement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/90 backdrop-blur-sm"
            onClick={() => setSelectedAchievement(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 40 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-surface-container-low rounded-[2.5rem] border border-primary/30 p-8 flex flex-col items-center gap-5 text-center shadow-[0_0_80px_rgba(202,253,0,0.15)] relative overflow-hidden"
            >
              <div className="absolute inset-0 rounded-[2.5rem] bg-primary/3 pointer-events-none" />
              <div className="relative">
                <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-150" />
                <span className="relative text-8xl">{selectedAchievement.icon}</span>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2">CONQUISTA DESBLOQUEADA</p>
                <h3 className="text-2xl font-headline font-black text-primary uppercase italic">{selectedAchievement.name}</h3>
                <p className="text-sm text-on-surface-variant font-bold mt-1">{selectedAchievement.description}</p>
              </div>
              <div className="w-full h-px bg-outline-variant/20" />
              <div>
                <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Conquistado por</p>
                <p className="text-xl font-headline font-black text-on-surface uppercase italic mt-1">{user?.name}</p>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Nível {user?.level}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setSelectedAchievement(null)}
                  className="flex-1 py-3 bg-surface-container-highest text-on-surface-variant rounded-2xl font-headline font-black text-xs uppercase italic">
                  FECHAR
                </button>
                <button onClick={() => handleShareAchievement(selectedAchievement)} disabled={sharing}
                  className="flex-1 py-3 bg-primary text-background rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 disabled:opacity-60">
                  {sharing
                    ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    : navigator.share
                      ? <><Share2 className="w-4 h-4" /> COMPARTILHAR</>
                      : <><Download className="w-4 h-4" /> BAIXAR</>
                  }
                </button>
              </div>
              <p className="text-[9px] text-on-surface-variant italic">
                {navigator.share ? 'Compartilhe no WhatsApp, Instagram e mais' : 'Baixe a imagem 1080x1080 e poste nas redes'}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
                    }
