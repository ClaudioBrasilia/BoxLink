import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Coins, MapPin, Timer, ChevronRight, Activity, Trophy, Share2, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, User } from '../types';
import confetti from 'canvas-confetti';
import AvatarPreview from '../components/AvatarPreview';
import { supabase } from '../lib/supabase';
import { addReward, checkAndPayWeeklyBonus, getRewardSettings } from '../utils/rewards';
import { useInactivity } from '../hooks/useInactivity';
import HeartRateUnified from '../components/HeartRateUnified';

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [wod, setWod] = useState<Wod | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ time: string; endTime: string; coach: string }[]>([]);
  const [now, setNow] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [userRankPosition, setUserRankPosition] = useState<number | null>(null);

  // 🎯 Inatividade do avatar do próprio atleta
  const checkinsList = (user?.checkins || []).map(c => ({ date: c.date }));
  const { fadePercent, showSleeping } = useInactivity(checkinsList);

  const fetchData = async () => {
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    let { data: wodsData } = await supabase.from('wods').select('*').eq('date', todayDate).maybeSingle();
    if (!wodsData) {
      const { data: latestWod } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(1).maybeSingle();
      wodsData = latestWod;
    }
    if (wodsData) setWod(wodsData);

    const { data: settingsData } = await supabase.from('box_settings').select('*').single();
    const rawAnn = settingsData?.announcements || settingsData?.tv_config?.announcements || [];
    if (Array.isArray(rawAnn) && rawAnn.length > 0) {
      const annTexts = rawAnn
        .filter((a: any) => a.active !== false)
        .map((a: any) => {
          if (typeof a === 'string') {
            try { const parsed = JSON.parse(a); return parsed.title ? `${parsed.title}${parsed.content ? ': ' + parsed.content : ''}` : a; }
            catch (e) { return a; }
          }
          return a.title ? `${a.title}${a.content ? ': ' + a.content : ''}` : '';
        }).filter(Boolean);
      setAnnouncements(annTexts);
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: challengesData } = await supabase
      .from('challenges').select('*').eq('active', true)
      .or(`end_date.is.null,end_date.gte.${today}`).limit(3);
    setActiveChallenges(challengesData || []);

    const { data: scheduleData } = await supabase.from('schedule').select('*').eq('is_active', true).order('time', { ascending: true });
    if (scheduleData) {
      const mappedSchedule = scheduleData.map((s: any) => ({
        id: s.id, time: s.time, endTime: s.end_time, coach: s.coach,
        capacity: s.capacity, days: s.days, isActive: s.is_active,
        checkinWindowMinutes: s.checkin_window_minutes
      }));
      setSchedule(mappedSchedule);
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      const current = mappedSchedule.find((s: any) => now >= s.time && now <= s.endTime);
      if (current) setSelectedClass(current.time);
    }

    if (user?.id) {
      const now2 = new Date();
      const firstDayOfMonth = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0];
      const { data: rewardHistory } = await supabase
        .from('reward_history').select('user_id, xp').gte('created_at', firstDayOfMonth + 'T00:00:00');
      const monthXpByUser: Record<string, number> = {};
      (rewardHistory || []).forEach((r: any) => {
        if (r.xp > 0) monthXpByUser[r.user_id] = (monthXpByUser[r.user_id] || 0) + r.xp;
      });
      const sorted = Object.entries(monthXpByUser).sort((a, b) => b[1] - a[1]);
      const pos = sorted.findIndex(([id]) => id === user.id);
      setUserRankPosition(pos >= 0 ? pos + 1 : null);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_settings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleCheckin = () => {
    if (!selectedClass) { setCheckinMessage('Por favor, selecione um horário de aula'); return; }
    setIsCheckingIn(true);
    setCheckinMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const { data: box } = await supabase.from('box_settings').select('*').single();
          if (!box) throw new Error('Configurações do box não encontradas');

          const distance = calculateDistance(latitude, longitude, box.lat, box.lng);
          if (distance > (box.radius || 500)) {
            setCheckinMessage(`Você está muito longe do box (${Math.round(distance)}m). Aproxime-se para fazer check-in.`);
            setIsCheckingIn(false);
            return;
          }

          const today = new Date().toISOString().split('T')[0];
          const { error: checkinError } = await supabase.from('checkins').insert({
            user_id: user?.id, date: today, class_time: selectedClass
          });

          if (checkinError) {
            if (checkinError.code === '23505') { setCheckinMessage('Você já realizou check-in hoje!'); }
            else { throw checkinError; }
            setIsCheckingIn(false);
            return;
          }

          const rewards = await getRewardSettings();
          const xp    = rewards.xp_per_checkin   ?? 20;
          const coins = rewards.coins_per_checkin ?? 5;

          const rewardResult = await addReward(user?.id!, 'checkin', xp, coins, `Check-in: ${selectedClass}`);

          let msg = `Check-in realizado! +${xp} XP, +${coins} BrazaCoins`;

          const weeklyResult = await checkAndPayWeeklyBonus(user?.id!);
          if (weeklyResult?.paid) {
            msg += ` 🎉 Bônus semanal: +${weeklyResult.xp} XP, +${weeklyResult.coins} BC (${weeklyResult.count} treinos!)`;
          }

          if (rewardResult?.levelUp) {
            msg += ` ⬆️ LEVEL UP! Nível ${rewardResult.newLevel}!`;
            setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] }), 500);
          }

          setCheckinMessage(msg);
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

          const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user?.id).maybeSingle();
          const { data: updatedCheckins } = await supabase.from('checkins').select('*').eq('user_id', user?.id);

          if (updatedProfile) {
            updateUser({
              id: updatedProfile.id, email: updatedProfile.email, name: updatedProfile.name,
              role: updatedProfile.role, status: updatedProfile.status,
              xp: updatedProfile.xp || 0, coins: updatedProfile.coins || 0, level: updatedProfile.level || 1,
              avatar: { equipped: updatedProfile.avatar_equipped, inventory: updatedProfile.avatar_inventory || [] },
              checkins: (updatedCheckins || []).map((c: any) => ({ date: c.date, timestamp: c.timestamp, classTime: c.class_time })),
              paidBonuses: updatedProfile.paid_bonuses || [],
              createdAt: updatedProfile.created_at
            } as User);
          }
        } catch (e: any) {
          console.error(e);
          setCheckinMessage('Erro ao realizar check-in: ' + (e.message || 'Erro desconhecido'));
        } finally { setIsCheckingIn(false); }
      },
      (error) => { setCheckinMessage('Erro de geolocalização: ' + error.message); setIsCheckingIn(false); }
    );
  };

  const today = new Date().toISOString().split('T')[0];
  const alreadyCheckedIn = (user?.checkins || []).some(c => c.date === today);

  const handleShare = () => {
    const appUrl = window.location.origin;
    const text = `💪 Estou treinando no BoxLink! Venha acompanhar meu progresso: ${appUrl}`;
    if (navigator.share) { navigator.share({ title: 'BoxLink', text, url: appUrl }).catch(() => {}); }
    else { setShowShareModal(true); }
  };

  const shareViaWhatsApp = () => {
    const appUrl = window.location.origin;
    window.open(`https://wa.me/?text=${encodeURIComponent(`💪 Estou treinando no BoxLink! Venha acompanhar meu progresso: ${appUrl}`)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          {/* 🎯 Avatar com efeito de inatividade */}
          <AvatarPreview
            equipped={user?.avatar.equipped!}
            size="sm"
            className="border-2"
            fadePercent={fadePercent}
            showSleeping={showSleeping}
          />
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight uppercase italic leading-none">
              OLÁ, <span className="text-primary">{user?.name.split(' ')[0]}</span>
            </h1>
            <p className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase mt-1 italic">
              {showSleeping ? '💤 Está na preguiça? Volte a treinar!' : 'Pronto para o treino?'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
            <span className="text-[10px] font-black text-primary uppercase italic">LVL {user?.level}</span>
            <div className="w-[1px] h-3 bg-outline-variant/20"></div>
            <Zap className="w-4 h-4 text-primary fill-primary" />
            <span className="font-headline font-black text-sm text-on-surface">{user?.xp}</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
            <Coins className="w-4 h-4 text-secondary fill-secondary" />
            <span className="font-headline font-black text-sm text-on-surface">{user?.coins}</span>
            <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">BC</span>
          </div>
          <button onClick={handleShare}
            className="flex items-center gap-1 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-all">
            <Share2 className="w-3 h-3 text-primary" />
            <span className="text-[8px] font-black text-primary uppercase tracking-widest">SHARE</span>
          </button>
        </div>
      </header>

      {announcements.length > 0 && (
        <section className="bg-primary/10 border border-primary/20 rounded-3xl p-4 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest italic">COMUNICADOS</h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann, idx) => (
              <p key={idx} className="text-xs font-bold text-on-surface leading-tight italic">• {ann}</p>
            ))}
          </div>
        </section>
      )}

      {activeChallenges.length > 0 && (
        <section className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-4 cursor-pointer hover:border-primary/30 transition-all"
          onClick={() => navigate('/challenges')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary/20 rounded-xl flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-[10px] font-black text-on-surface uppercase tracking-widest italic">DESAFIOS ATIVOS</h3>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{activeChallenges.length}</span>
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {activeChallenges.slice(0,2).map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-surface-container-highest/50 rounded-2xl px-3 py-2">
                <p className="text-xs font-bold text-on-surface uppercase italic truncate flex-1">{c.title}</p>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="text-[9px] font-black text-primary">+{c.xp} XP</span>
                  <span className="text-[9px] font-black text-secondary">+{c.coins} BC</span>
                </div>
              </div>
            ))}
            {activeChallenges.length > 2 && (
              <p className="text-[9px] text-center text-on-surface-variant font-bold uppercase tracking-widest">
                +{activeChallenges.length - 2} outros desafios
              </p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        {!alreadyCheckedIn && (
          <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-3">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest px-2">SELECIONE SEU HORÁRIO:</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {(() => {
                const todayDow = now.getDay();
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
                const todaySchedule = schedule.filter((s: any) => s.days?.includes(todayDow));
                if (todaySchedule.length === 0) {
                  return <p className="text-on-surface-variant text-xs font-bold uppercase italic px-2 opacity-50">Nenhuma aula hoje</p>;
                }
                return todaySchedule.map((s: any) => {
                  const [h, m] = s.time.split(':').map(Number);
                  const expired = nowMinutes > h * 60 + m + 10;
                  return (
                    <button key={s.time} onClick={() => !expired && setSelectedClass(s.time)} disabled={expired}
                      className={cn(
                        "flex flex-col items-center min-w-[80px] p-3 rounded-2xl border transition-all",
                        expired ? "bg-surface-container-highest/40 border-outline-variant/10 opacity-40 cursor-not-allowed"
                          : selectedClass === s.time ? "bg-primary border-primary text-background"
                          : "bg-surface-container-highest border-outline-variant/20 text-on-surface"
                      )}>
                      <span className={cn("text-sm font-headline font-black", expired ? "line-through" : "")}>{s.time}</span>
                      <span className={cn("text-[8px] font-bold uppercase tracking-tighter", selectedClass === s.time ? "text-background/60" : "text-on-surface-variant")}>
                        {expired ? "encerrada" : s.coach.split(' ')[0]}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        <button onClick={handleCheckin} disabled={isCheckingIn || alreadyCheckedIn}
          className={cn(
            "w-full py-6 rounded-3xl font-headline font-black text-xl shadow-lg transition-all uppercase italic tracking-tight flex items-center justify-center gap-3",
            alreadyCheckedIn
              ? "bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-50"
              : "bg-primary text-background hover:scale-[0.98] active:scale-95 shadow-[0_10px_30px_rgba(202,253,0,0.2)]"
          )}>
          {isCheckingIn ? "VALIDANDO..." : alreadyCheckedIn ? "CHECK-IN REALIZADO" : "FAZER CHECK-IN AGORA"}
          <MapPin className={cn("w-6 h-6", alreadyCheckedIn ? "text-on-surface-variant" : "fill-current")} />
        </button>
        {checkinMessage && (
          <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-2 text-primary">{checkinMessage}</p>
        )}
      </section>

      <HeartRateUnified userId={user?.id} />

      <section onClick={() => navigate('/wod')}
        className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-all group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
            <Timer className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">HOJE</span>
              <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">{wod?.type || '—'}</span>
            </div>
            <h3 className="font-headline font-black text-base text-on-surface uppercase italic tracking-tight leading-tight">
              {wod?.name || 'WOD DO DIA'}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant group-hover:text-primary transition-colors shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest">VER</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
          <div className="bg-primary/20 w-10 h-10 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Check-ins Semana</p>
            <p className="text-2xl font-headline font-black text-on-surface">
              {(user?.checkins || []).filter(c => {
                const checkinDate = new Date(c.timestamp);
                const now = new Date();
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                return checkinDate >= startOfWeek;
              }).length}/6
            </p>
          </div>
        </div>
        <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
          <div className="bg-secondary/20 w-10 h-10 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Ranking Box</p>
            <p className="text-2xl font-headline font-black text-on-surface">
              {userRankPosition != null ? `#${userRankPosition}` : '—'}
            </p>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}>
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <h3 className="font-headline font-bold text-xl text-on-surface uppercase italic mb-6 flex items-center gap-3">
                <Share2 className="w-6 h-6 text-primary" /> COMPARTILHAR APP
              </h3>
              <div className="flex flex-col gap-3">
                <button onClick={shareViaWhatsApp}
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-headline font-black uppercase italic flex items-center justify-center gap-3">
                  📱 COMPARTILHAR VIA WHATSAPP
                </button>
                <button onClick={() => { navigator.clipboard.writeText(window.location.origin); alert('Link copiado!'); setShowShareModal(false); }}
                  className="w-full bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-black uppercase italic flex items-center justify-center gap-3">
                  🔗 COPIAR LINK
                </button>
                <button onClick={() => setShowShareModal(false)}
                  className="w-full text-on-surface-variant py-3 font-headline font-black uppercase italic text-sm">
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
