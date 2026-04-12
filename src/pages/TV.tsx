import React, { useState, useEffect } from 'react';
import { Timer, Trophy, Zap, Swords, Maximize, LayoutDashboard, Activity, Users, Play, Pause, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, Challenge, Duel, User, BoxSettings } from '../types';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import AvatarPreview from '../components/AvatarPreview';

const TIMEZONE = "America/Sao_Paulo";

export default function TV() {
  const [data, setData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [athleteIndex, setAthleteIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");

      // Fetch all data in parallel
      const [
        { data: settings },
        { data: economy },
        { data: wod },
        { data: challenges },
        { data: duels },
        { data: rankings }
      ] = await Promise.all([
        supabase.from('box_settings').select('*').maybeSingle(),
        supabase.from('avatar_economy_settings').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('wods').select('*').eq('date', today).maybeSingle(),
        supabase.from('challenges').select('*').eq('active', true),
        supabase.from('duels').select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)').eq('status', 'accepted'),
        supabase.from('profiles').select('name, xp, level, avatar_equipped').order('xp', { ascending: false }).limit(10)
      ]);

      const { data: checkinsRaw } = await supabase
        .from('checkins')
        .select('*')
        .gte('date', today)
        .order('timestamp', { ascending: false })
        .limit(20);

      const { data: profilesRaw } = await supabase
        .from('profiles')
        .select('id, name, avatar_equipped');

      const profileMap = Object.fromEntries((profilesRaw || []).map((p: any) => [p.id, p]));
      const checkins = (checkinsRaw || []).map((c: any) => ({
        ...c,
        profiles: profileMap[c.user_id] || null
      }));

      // Mocked stats for the ticker
      const stats = {
        frequency: "92% OPTIMAL",
        newRecord: "JULIA M. (158 REPS)",
        upcoming: "HYPERTROPHY STRENGTH"
      };

      setData({
        settings: settings || { name: "CrossCity Hub", logo: "" },
        rewards: economy,
        wod: wod || { name: "WOD de Hoje", type: "AMRAP", warmup: "400M RUN\n20 AIR SQUATS", skill: "SNATCH FOCUS\n5 x 3 @ 65% 1RM", rx: "A definir", scaled: "A definir", beginner: "A definir" },
        checkins: checkins || [],
        challenges: challenges || [],
        duels: (duels || []).map((d: any) => ({
          ...d,
          challengerName: d.challenger?.name || 'Atleta',
          opponentName: d.opponent?.name || 'Atleta'
        })),
        rankings: rankings || [],
        stats
      });
      setError(null);
    } catch (err: any) {
      console.error('TV Fetch Error:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    
    const athleteInterval = setInterval(() => {
      setAthleteIndex(prev => {
        const count = data?.rankings?.length || 1;
        return (prev + 1) % count;
      });
    }, 8000);

    const checkinsChannel = supabase.channel('tv-checkins')
      .on('postgres_changes', { event: '*', table: 'checkins' }, fetchData)
      .subscribe();

    return () => {
      clearInterval(interval);
      clearInterval(athleteInterval);
      supabase.removeChannel(checkinsChannel);
    };
  }, [data?.rankings?.length]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (error && !data) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-red-500 font-headline font-black text-2xl italic p-8 text-center">
      <p>ERRO DE CONEXÃO COM A ARENA</p>
      <p className="text-sm mt-4 text-white/60 font-sans not-italic">{error}</p>
      <button 
        onClick={fetchData}
        className="mt-8 bg-primary text-black px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-transform"
      >
        TENTAR RECONECTAR
      </button>
    </div>
  );

  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-primary font-headline font-black text-4xl italic animate-pulse">PREPARANDO ARENA...</div>;

  const { wod, checkins, settings, rankings, stats, duels } = data;
  const rankingsCount = rankings?.length || 0;
  const currentAthlete = rankingsCount > 0 ? rankings[athleteIndex % rankingsCount] : null;
  const nextAthlete = rankingsCount > 1 ? rankings[(athleteIndex + 1) % rankingsCount] : null;

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col p-6 gap-6 relative select-none">
      {/* Header */}
      <header className="flex justify-between items-center bg-[#111] rounded-[2rem] p-6 border border-white/5 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="relative">
            <img src={settings.logo || "https://picsum.photos/seed/box/200"} alt="Logo" className="w-16 h-16 rounded-2xl border-2 border-primary shadow-[0_0_20px_rgba(202,253,0,0.3)]" />
            <div className="absolute -bottom-2 -right-2 bg-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase italic">ELITE</div>
          </div>
          <div>
            <h1 className="text-4xl font-headline font-black text-white italic tracking-tighter uppercase leading-none">{settings.name}</h1>
            <p className="text-primary text-[10px] font-black tracking-[0.4em] uppercase italic mt-1">CROSSCITY HUB • PERFORMANCE ELITE</p>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="flex flex-col items-center">
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">HORA ATUAL</span>
            <span className="text-4xl font-headline font-black text-white italic tabular-nums">{format(new Date(), 'HH:mm:ss')}</span>
          </div>
          
          <div className="h-12 w-[1px] bg-white/10"></div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-primary font-headline font-black text-3xl italic leading-none tabular-nums">{formatTime(timer)}</span>
              <span className="text-white/40 text-[8px] font-black uppercase tracking-widest mt-1">TIMER ATIVO</span>
            </div>
            <button 
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                isTimerRunning ? "bg-red-500 text-white" : "bg-primary text-black"
              )}
            >
              {isTimerRunning ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
            <button 
              onClick={() => { setTimer(0); setIsTimerRunning(false); }}
              className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggleFullscreen} className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-primary hover:text-black transition-all group">
            <Maximize className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Left: WARM-UP & THE WOD */}
        <div className="col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6 h-[40%]">
            {/* WARM-UP */}
            <section className="bg-[#111] rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6">
                <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary animate-pulse" />
                </div>
              </div>
              <h3 className="text-primary text-xs font-black uppercase tracking-[0.3em] italic mb-6">WARM-UP</h3>
              <div className="space-y-4">
                {(wod?.warmup || '').split('\n').filter(Boolean).map((line: string, i: number) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#cafd00]"></div>
                    <p className="text-2xl font-headline font-black text-white uppercase italic tracking-tight">{line}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* SKILL */}
            <section className="bg-[#111] rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6">
                <span className="bg-secondary/20 text-secondary text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest border border-secondary/30 italic">TECHNIQUE</span>
              </div>
              <h3 className="text-secondary text-xs font-black uppercase tracking-[0.3em] italic mb-6">SKILL</h3>
              <div className="space-y-2">
                <h4 className="text-4xl font-headline font-black text-white uppercase italic tracking-tighter leading-none mb-6">{(wod?.skill || '').split('\n')[0] || '---'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-white/40 text-[8px] font-black uppercase tracking-widest block mb-1">SETS</span>
                    <span className="text-2xl font-headline font-black text-white italic">5 x 3</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-white/40 text-[8px] font-black uppercase tracking-widest block mb-1">LOAD</span>
                    <span className="text-2xl font-headline font-black text-secondary italic">65% 1RM</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* THE WOD */}
          <section className="bg-[#111] rounded-[3rem] p-10 border border-white/5 flex-1 relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-50"></div>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-white/40 text-xs font-black uppercase tracking-[0.5em] italic">MAIN EVENT</span>
              <div className="h-[1px] flex-1 bg-white/10"></div>
            </div>
            <h2 className="text-[10rem] font-headline font-black text-white italic tracking-tighter uppercase leading-[0.8] mb-6">THE WOD</h2>
            <div className="flex items-center gap-8">
              <div className="bg-primary text-black px-8 py-3 rounded-2xl font-headline font-black text-4xl italic uppercase tracking-tighter">
                {wod.type} 20
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-white/60 text-xl font-bold uppercase tracking-widest leading-tight">{wod.name}</p>
                <div className="flex gap-4">
                  <span className="text-secondary text-xs font-black uppercase tracking-widest">RX: {wod.rx}</span>
                  <span className="text-white/40 text-xs font-black uppercase tracking-widest">SCALED: {wod.scaled}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: CHECK-IN & ATHLETE CARDS */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* CHECK-IN */}
          <section className="bg-[#111] rounded-[2.5rem] p-8 border border-white/5 h-[30%] flex flex-col justify-center">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-headline font-black text-white italic uppercase tracking-tight">CHECK-IN</h3>
              </div>
              <div className="bg-primary/20 text-primary px-4 py-1 rounded-full font-headline font-black text-xl italic">
                {checkins.length}/20
              </div>
            </div>
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(checkins.length / 20) * 100}%` }}
                className="h-full bg-primary shadow-[0_0_15px_#cafd00]"
              />
            </div>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-4 text-center italic">CLASS TIME: 08:00 AM • COACH: BRUNO S.</p>
          </section>

          {/* ATHLETE ROTATION */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 flex-1 relative overflow-hidden p-8 flex flex-col">
            <AnimatePresence mode="wait">
              {currentAthlete && (
                <motion.div 
                  key={currentAthlete.id || athleteIndex}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.05, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col h-full"
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className="relative">
                      <AvatarPreview equipped={currentAthlete.avatar_equipped} size="lg" className="border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]" />
                      <div className="absolute -bottom-2 -right-2 bg-secondary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic shadow-lg">ELITE</div>
                    </div>
                    <div>
                      <h4 className="text-4xl font-headline font-black text-white uppercase italic tracking-tighter leading-none">{currentAthlete.name}</h4>
                      <p className="text-primary text-xs font-black uppercase tracking-widest mt-2">ELITE MEMBER</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-auto">
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                      <span className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-2">CURRENT PERFORMANCE</span>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-headline font-black text-white italic">158</span>
                        <span className="text-primary text-[10px] font-black uppercase mb-1">REPS</span>
                      </div>
                    </div>
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                      <span className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-2">XP EARNED</span>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-headline font-black text-white italic">138</span>
                        <span className="text-secondary text-[10px] font-black uppercase mb-1">XP</span>
                      </div>
                    </div>
                  </div>

                  {nextAthlete && (
                    <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/40 font-headline font-black italic">
                          {nextAthlete?.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white/40 text-[8px] font-black uppercase tracking-widest">NEXT UP</p>
                          <p className="text-lg font-headline font-black text-white/80 uppercase italic leading-none">{nextAthlete?.name || '---'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i === athleteIndex % 3 ? "bg-primary" : "bg-white/10")} />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>

      {/* Footer Ticker */}
      <footer className="h-16 bg-[#111] rounded-2xl border border-white/5 overflow-hidden flex items-center relative">
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-24 animate-marquee whitespace-nowrap items-center">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-24 items-center">
                <div className="flex items-center gap-4">
                  <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">FREQUENCY:</span>
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.frequency}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-white/20"></div>

                {duels?.map((d: any) => (
                  <React.Fragment key={d.id}>
                    <div className="flex items-center gap-4">
                      <Swords className="w-4 h-4 text-secondary" />
                      <span className="text-secondary text-[10px] font-black uppercase tracking-widest italic">DUEL:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">
                        {d.challengerName} <span className="text-white/30 mx-2">VS</span> {d.opponentName}
                      </span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </React.Fragment>
                ))}

                <div className="flex items-center gap-4">
                  <span className="text-secondary text-[10px] font-black uppercase tracking-widest italic">NEW BOX RECORD:</span>
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.newRecord}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-white/20"></div>
                <div className="flex items-center gap-4">
                  <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">UPCOMING:</span>
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.upcoming}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-white/20"></div>
              </div>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 40s linear infinite;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
