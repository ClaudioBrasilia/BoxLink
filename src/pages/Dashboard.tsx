import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Coins, MapPin, Timer, ChevronRight, Activity, Trophy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, User } from '../types';
import confetti from 'canvas-confetti';
import AvatarPreview from '../components/AvatarPreview';
import { supabase } from '../lib/supabase';

import { addReward } from '../utils/rewards';

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [wod, setWod] = useState<Wod | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ time: string; endTime: string; coach: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [showWodDetails, setShowWodDetails] = useState(false);

  const fetchData = async () => {
    // Fetch WODs - Filter by today's date in the correct timezone
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const { data: wodsData } = await supabase
      .from('wods')
      .select('*')
      .eq('date', today)
      .maybeSingle();
    
    if (wodsData) {
      setWod(wodsData);
    } else {
      // Fallback: if no WOD for today, get the most recent one (optional, but keeps the UI from being empty if that's preferred)
      // However, the user specifically complained about old WODs appearing, so we should probably only show today's.
      setWod(null);
    }
    
    // Fetch Box Settings
    const { data: settingsData } = await supabase.from('box_settings').select('*').single();
    if (settingsData?.tv_config?.announcements) {
      setAnnouncements(settingsData.tv_config.announcements);
    }

    // Fetch Schedule
    const { data: scheduleData } = await supabase.from('schedule').select('*').eq('is_active', true).order('time', { ascending: true });
    if (scheduleData) {
      const mappedSchedule = scheduleData.map((s: any) => ({
        id: s.id,
        time: s.time,
        endTime: s.end_time,
        coach: s.coach,
        capacity: s.capacity,
        days: s.days,
        isActive: s.is_active,
        checkinWindowMinutes: s.checkin_window_minutes
      }));
      setSchedule(mappedSchedule);
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      const current = mappedSchedule.find((s: any) => now >= s.time && now <= s.endTime);
      if (current) setSelectedClass(current.time);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_settings' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const handleCheckin = () => {
    if (!selectedClass) {
      setCheckinMessage('Por favor, selecione um horário de aula');
      return;
    }
    setIsCheckingIn(true);
    setCheckinMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // 1. Get Box Settings for location validation
          const { data: box } = await supabase.from('box_settings').select('*').single();
          if (!box) throw new Error('Configurações do box não encontradas');

          const distance = calculateDistance(latitude, longitude, box.lat, box.lng);
          if (distance > (box.radius || 500)) {
            setCheckinMessage(`Você está muito longe do box (${Math.round(distance)}m). Aproxime-se para fazer check-in.`);
            setIsCheckingIn(false);
            return;
          }

          // 2. Register Check-in
          const today = new Date().toISOString().split('T')[0];
          const { error: checkinError } = await supabase
            .from('checkins')
            .insert({
              user_id: user?.id,
              date: today,
              class_time: selectedClass
            });

          if (checkinError) {
            if (checkinError.code === '23505') { // Unique constraint
              setCheckinMessage('Você já realizou check-in hoje!');
            } else {
              throw checkinError;
            }
            setIsCheckingIn(false);
            return;
          }

          // 3. Add Rewards
          const { data: economy } = await supabase.from('avatar_economy_settings').select('*').eq('is_active', true).single();
          const xp = economy?.xp_per_checkin || 20;
          const coins = economy?.coins_per_checkin || 5;

          const rewardResult = await addReward(user?.id!, 'checkin', xp, coins, `Check-in: ${selectedClass}`);
          
          setCheckinMessage(`Check-in realizado! +${xp} XP, +${coins} BrazaCoins`);
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          
          if (rewardResult?.levelUp) {
            setTimeout(() => {
              confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] });
            }, 500);
          }

          // 4. Refresh user profile
          const { data: updatedProfile } = await supabase
            .from('profiles').select('*').eq('id', user?.id).maybeSingle();
          const { data: updatedCheckins } = await supabase
            .from('checkins').select('*').eq('user_id', user?.id);

          if (updatedProfile) {
            const mappedUser: User = {
              id: updatedProfile.id,
              email: updatedProfile.email,
              name: updatedProfile.name,
              role: updatedProfile.role,
              status: updatedProfile.status,
              xp: updatedProfile.xp || 0,
              coins: updatedProfile.coins || 0,
              level: updatedProfile.level || 1,
              avatar: {
                equipped: updatedProfile.avatar_equipped,
                inventory: updatedProfile.avatar_inventory || []
              },
              checkins: (updatedCheckins || []).map((c: any) => ({
                date: c.date,
                timestamp: c.timestamp,
                classTime: c.class_time
              })),
              paidBonuses: updatedProfile.paid_bonuses || [],
              createdAt: updatedProfile.created_at
            };
            updateUser(mappedUser);
          }
        } catch (e: any) {
          console.error(e);
          setCheckinMessage('Erro ao realizar check-in: ' + (e.message || 'Erro desconhecido'));
        } finally {
          setIsCheckingIn(false);
        }
      },
      (error) => {
        setCheckinMessage('Erro de geolocalização: ' + error.message);
        setIsCheckingIn(false);
      }
    );
  };

  const today = new Date().toISOString().split('T')[0];
  const alreadyCheckedIn = user?.checkins.some(c => c.date === today);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <AvatarPreview equipped={user?.avatar.equipped!} size="sm" className="border-2" />
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight uppercase italic leading-none">
              OLÁ, <span className="text-primary">{user?.name.split(' ')[0]}</span>
            </h1>
            <p className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase mt-1 italic">Pronto para o treino?</p>
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
        </div>
      </header>

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="bg-primary/10 border border-primary/20 rounded-3xl p-4 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest italic">COMUNICADOS</h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann, idx) => (
              <p key={idx} className="text-xs font-bold text-on-surface leading-tight italic">
                • {ann}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Check-in Section */}
      <section className="space-y-4">
        {!alreadyCheckedIn && (
          <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-3">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest px-2">SELECIONE SEU HORÁRIO:</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {schedule.map((s) => (
                <button
                  key={s.time}
                  onClick={() => setSelectedClass(s.time)}
                  className={cn(
                    "flex flex-col items-center min-w-[80px] p-3 rounded-2xl border transition-all",
                    selectedClass === s.time 
                      ? "bg-primary border-primary text-background" 
                      : "bg-surface-container-highest border-outline-variant/20 text-on-surface"
                  )}
                >
                  <span className="text-sm font-headline font-black">{s.time}</span>
                  <span className={cn("text-[8px] font-bold uppercase tracking-tighter", selectedClass === s.time ? "text-background/60" : "text-on-surface-variant")}>
                    {s.coach.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleCheckin}
          disabled={isCheckingIn || alreadyCheckedIn}
          className={cn(
            "w-full py-6 rounded-3xl font-headline font-black text-xl shadow-lg transition-all uppercase italic tracking-tight flex items-center justify-center gap-3",
            alreadyCheckedIn 
              ? "bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-50" 
              : "bg-primary text-background hover:scale-[0.98] active:scale-95 shadow-[0_10px_30px_rgba(202,253,0,0.2)]"
          )}
        >
          {isCheckingIn ? "VALIDANDO..." : alreadyCheckedIn ? "CHECK-IN REALIZADO" : "FAZER CHECK-IN AGORA"}
          <MapPin className={cn("w-6 h-6", alreadyCheckedIn ? "text-on-surface-variant" : "fill-current")} />
        </button>
        {checkinMessage && (
          <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-2 text-primary">{checkinMessage}</p>
        )}
      </section>

      {/* Daily WOD Preview */}
      <section className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4">
          <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">HOJE</span>
        </div>
        <h3 className="font-headline font-black text-2xl text-on-surface mb-1 uppercase italic tracking-tight">WOD DO DIA</h3>
        
        {wod ? (
          <>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-4">{wod.name}</p>
            
            <div className="flex gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</span>
                <span className="text-sm font-headline font-black text-on-surface uppercase italic">{wod.type}</span>
              </div>
              <div className="w-[1px] bg-outline-variant/20"></div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Time Cap</span>
                <span className="text-sm font-headline font-black text-on-surface uppercase italic">20:00</span>
              </div>
            </div>

            <button 
              onClick={() => setShowWodDetails(true)}
              className="w-full bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary hover:text-background transition-all uppercase italic"
            >
              VER DETALHES <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest italic opacity-50">Nenhum WOD cadastrado para hoje</p>
          </div>
        )}
      </section>

      {/* WOD Details Modal */}
      <AnimatePresence>
        {showWodDetails && wod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWodDetails(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-headline font-black text-on-surface uppercase italic tracking-tight">{wod.name}</h2>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">{wod.type}</p>
                  </div>
                  <button 
                    onClick={() => setShowWodDetails(false)}
                    className="p-2 bg-surface-container-highest rounded-full text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {wod.warmup && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-2">
                        <Timer className="w-3 h-3 text-primary" /> AQUECIMENTO
                      </h4>
                      <p className="text-sm text-on-surface font-medium leading-relaxed bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/5">
                        {wod.warmup}
                      </p>
                    </div>
                  )}

                  {wod.skill && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3 text-primary" /> TÉCNICA / SKILL
                      </h4>
                      <p className="text-sm text-on-surface font-medium leading-relaxed bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/5">
                        {wod.skill}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-3 h-3 text-primary" /> WORKOUT (WOD)
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        <span className="text-[8px] font-black text-primary uppercase tracking-widest mb-1 block">RX</span>
                        <p className="text-sm text-on-surface font-bold leading-relaxed whitespace-pre-wrap">{wod.rx}</p>
                      </div>
                      <div className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/5">
                        <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest mb-1 block">SCALED</span>
                        <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap">{wod.scaled}</p>
                      </div>
                      <div className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/5">
                        <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest mb-1 block">BEGINNER</span>
                        <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap">{wod.beginner}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-surface-container-highest/50 border-t border-outline-variant/10">
                <button 
                  onClick={() => setShowWodDetails(false)}
                  className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg"
                >
                  ENTENDIDO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 gap-4">
        <button 
          onClick={() => navigate('/challenges')}
          className="bg-secondary/10 border border-secondary/20 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-secondary/20 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-secondary/20 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-secondary fill-secondary" />
            </div>
            <div className="text-left">
              <h3 className="font-headline font-black text-xl text-on-surface uppercase italic leading-none mb-1">DESAFIOS</h3>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Conclua e ganhe recompensas</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-secondary" />
        </button>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
          <div className="bg-primary/20 w-10 h-10 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Check-ins Semana</p>
            <p className="text-2xl font-headline font-black text-on-surface">
              {user?.checkins.filter(c => {
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
            <p className="text-2xl font-headline font-black text-on-surface">#12</p>
          </div>
        </div>
      </section>
    </div>
  );
}
