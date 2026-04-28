import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Coins, MapPin, Timer, ChevronRight, Activity, Trophy, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, User, Item } from '../types';
import confetti from 'canvas-confetti';
import AvatarPreview from '../components/AvatarPreview';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';
import ShareAppButton from '../components/ShareAppButton';

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [wod, setWod] = useState<Wod | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ time: string; endTime: string; coach: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: wodsData } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(1);
    if (wodsData) setWod(wodsData[0]);
    
    const { data: settingsData } = await supabase.from('box_settings').select('*').single();
    if (settingsData?.announcements) {
      setAnnouncements(settingsData.announcements.filter((a: any) => a.active).map((a: any) => a.title));
    }

    const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true).limit(3);
    setActiveChallenges(challengesData || []);

    const { data: scheduleData } = await supabase.from('schedule').select('*').eq('is_active', true).order('time', { ascending: true });
    if (scheduleData) {
      setSchedule(scheduleData);
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      const current = (scheduleData || []).find((s: any) => now >= s.time && now <= s.end_time);
      if (current) setSelectedClass(current.time);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleCheckin = () => {
    if (!selectedClass) {
      setCheckinMessage('Selecione um horário');
      return;
    }
    setIsCheckingIn(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { data: box } = await supabase.from('box_settings').select('*').single();
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, box.lat, box.lng);
        
        if (dist > (box.radius || 500)) {
          setCheckinMessage('Você está fora do raio do box!');
          setIsCheckingIn(false);
          return;
        }

        const { error } = await supabase.from('checkins').insert({ user_id: user?.id, date: new Date().toISOString().split('T')[0], class_time: selectedClass });
        if (error) throw error;

        await addReward(user?.id!, 'checkin', 20, 5, `Check-in: ${selectedClass}`);
        setCheckinMessage('Check-in realizado! +20 XP');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        
        // Atualiza perfil local
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
        if (profile) updateUser({ ...user!, ...profile });
      } catch (e) {
        setCheckinMessage('Erro ao fazer check-in');
      } finally {
        setIsCheckingIn(false);
      }
    }, () => {
      setCheckinMessage('Ative o GPS para fazer check-in');
      setIsCheckingIn(false);
    });
  };

  const alreadyCheckedIn = user?.checkins?.some(c => c.date === new Date().toISOString().split('T')[0]);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <AvatarPreview equipped={user?.avatar.equipped as any} size="sm" />
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight uppercase italic">
              OLÁ, <span className="text-primary">{user?.name.split(' ')[0]}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full italic">LVL {user?.level}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-primary font-headline font-black">
          <div className="flex items-center gap-1 bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/10">
            <Zap className="w-4 h-4 fill-primary" /> {user?.xp}
          </div>
          <div className="flex items-center gap-1 bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/10 text-secondary">
            <Coins className="w-4 h-4 fill-secondary" /> {user?.coins}
          </div>
        </div>
      </header>

      {/* Seção de Check-in */}
      <section className="bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10 shadow-xl">
        <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-4 italic">Fazer Check-in Agora</h3>
        {!alreadyCheckedIn && (
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
            {schedule.map(s => (
              <button 
                key={s.time}
                onClick={() => setSelectedClass(s.time)}
                className={cn(
                  "px-4 py-3 rounded-2xl font-headline font-black transition-all min-w-[80px]",
                  selectedClass === s.time ? "bg-primary text-black" : "bg-surface-container-highest text-on-surface"
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={handleCheckin}
          disabled={alreadyCheckedIn || isCheckingIn}
          className={cn(
            "w-full py-5 rounded-3xl font-headline font-black text-xl italic uppercase tracking-tight flex items-center justify-center gap-3",
            alreadyCheckedIn ? "bg-surface-container-highest text-on-surface-variant opacity-50" : "bg-primary text-background shadow-[0_10px_30px_rgba(202,253,0,0.3)] transition-all active:scale-95"
          )}
        >
          {alreadyCheckedIn ? 'CHECK-IN REALIZADO ✓' : isCheckingIn ? 'VALIDANDO...' : 'ENTRAR NA ARENA'}
          {!alreadyCheckedIn && <MapPin className="w-6 h-6 fill-current" />}
        </button>
        {checkinMessage && <p className="text-center text-[10px] font-black text-primary uppercase mt-3">{checkinMessage}</p>}
      </section>

      {/* Atalho WOD */}
      <section onClick={() => navigate('/wod')} className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5 flex items-center justify-between cursor-pointer group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center"><Timer className="w-6 h-6 text-primary" /></div>
          <div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">WOD DO DIA</span>
            <h3 className="font-headline font-black text-lg text-on-surface uppercase italic leading-none">{wod?.name || 'Carregando...'}</h3>
          </div>
        </div>
        <ChevronRight className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
      </section>

      <ShareAppButton />
    </div>
  );
}
