import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Coins, MapPin, Activity, Trophy, Share2, Target } from 'lucide-react';
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
  const [userRank, setUserRank] = useState<number | null>(null);

  const fetchData = async () => {
    const { data: wodsData } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(1);
    if (wodsData) setWod(wodsData[0]);
    
    const { data: settingsData } = await supabase.from('box_settings').select('*').single();
    const rawAnn = settingsData?.announcements || settingsData?.tv_config?.announcements || [];
    if (Array.isArray(rawAnn)) {
      setAnnouncements(rawAnn.map((a: any) => a.title || a).filter(Boolean));
    }

    const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true).limit(3);
    setActiveChallenges(challengesData || []);

    // Calcular posição no ranking por XP
    if (user?.id) {
      const { data: allProfiles } = await supabase.from('profiles').select('id, xp').eq('status', 'approved').order('xp', { ascending: false });
      if (allProfiles) {
        const pos = allProfiles.findIndex((p: any) => p.id === user.id);
        setUserRank(pos >= 0 ? pos + 1 : null);
      }
    }

    const { data: scheduleData } = await supabase.from('schedule').select('*').eq('is_active', true).order('time', { ascending: true });
    if (scheduleData) {
      setSchedule(scheduleData);
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      const current = scheduleData.find((s: any) => now >= s.time && now <= s.end_time);
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
    if (!selectedClass) { setCheckinMessage('Selecione um horário'); return; }
    setIsCheckingIn(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { data: box } = await supabase.from('box_settings').select('*').single();
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, box.lat, box.lng);
        if (dist > (box.radius || 500)) {
          setCheckinMessage(`Você está fora do raio do box (${Math.round(dist)}m)`);
          setIsCheckingIn(false);
          return;
        }
        const { error } = await supabase.from('checkins').insert({ user_id: user?.id, date: new Date().toISOString().split('T')[0], class_time: selectedClass });
        if (error) throw error;
        
        await addReward(user?.id!, 'checkin', 20, 5, `Check-in: ${selectedClass}`);
        setCheckinMessage('Check-in realizado! +20 XP, +5 BC');
        confetti({ particleCount: 150, spread: 70 });
        fetchData();
      } catch (e: any) {
        setCheckinMessage(e.code === '23505' ? 'Check-in já realizado hoje!' : 'Erro no check-in');
      } finally { setIsCheckingIn(false); }
    }, () => { setCheckinMessage('Ative o GPS'); setIsCheckingIn(false); });
  };

  const alreadyCheckedIn = user?.checkins?.some(c => c.date === new Date().toISOString().split('T')[0]);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <AvatarPreview equipped={user?.avatar.equipped ?? {} as any} size="sm" />
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight uppercase italic leading-none">
              OLÁ, <span className="text-primary">{user?.name.split(' ')[0]}</span>
            </h1>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase mt-1 italic">PRONTO PARA O TREINO?</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
            <Zap className="w-4 h-4 text-primary fill-primary" />
            <span className="font-headline font-black text-sm">{user?.xp}</span>
          </div>
          <ShareAppButton />
        </div>
      </header>

      {!alreadyCheckedIn && (
        <section className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {schedule.map((s) => (
              <button key={s.time} onClick={() => setSelectedClass(s.time)} className={cn("min-w-[80px] p-3 rounded-2xl border transition-all", selectedClass === s.time ? "bg-primary text-background border-primary" : "bg-surface-container-highest border-transparent")}>
                <span className="text-sm font-black">{s.time}</span>
              </button>
            ))}
          </div>
          <button onClick={handleCheckin} disabled={isCheckingIn} className="w-full py-5 bg-primary text-background rounded-3xl font-black text-lg uppercase italic shadow-[0_10px_30px_rgba(202,253,0,0.3)]">
            {isCheckingIn ? "VALIDANDO..." : "FAZER CHECK-IN AGORA"}
          </button>
        </section>
      )}

      {alreadyCheckedIn && (
        <div className="bg-primary/20 p-6 rounded-3xl border border-primary/30 text-center">
          <p className="text-primary font-black uppercase italic">✓ Check-in realizado hoje!</p>
        </div>
      )}


      {/* Comunicados */}
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

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10">
          <Activity className="w-5 h-5 text-primary mb-2" />
          <p className="text-[10px] text-on-surface-variant font-bold uppercase">Check-ins Semana</p>
          <p className="text-2xl font-black">{user?.checkins?.length || 0}/6</p>
        </div>
        <div onClick={() => navigate('/leaderboard')} className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 cursor-pointer">
          <Trophy className="w-5 h-5 text-secondary mb-2" />
          <p className="text-[10px] text-on-surface-variant font-bold uppercase">Ranking Box</p>
          <p className="text-2xl font-black">{userRank ? `#${userRank}` : '#--'}</p>
        </div>
      </section>
    </div>
  );
}
