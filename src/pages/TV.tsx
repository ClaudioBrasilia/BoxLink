import React, { useState, useEffect } from 'react';
import { Timer, Trophy, Zap, Swords, Maximize, LayoutDashboard, Activity, Users, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [isWodAutoRotationActive, setIsWodAutoRotationActive] = useState(true);
  const [athleteIndex, setAthleteIndex] = useState(0);
  const [rankingTab, setRankingTab] = useState<'xp' | 'freq'>('xp');
  const [freqRanking, setFreqRanking] = useState<any[]>([]);
  const [wodTabIndex, setWodTabIndex] = useState(0);

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
        supabase.from('profiles').select('name, xp, level, avatar_equipped').eq('status', 'approved').order('xp', { ascending: false }).limit(10)
      ]);

      const { data: checkinsRaw } = await supabase
        .from('checkins').select('*')
        .gte('date', today)
        .order('timestamp', { ascending: false })
        .limit(20);

      const { data: profilesRaw } = await supabase
        .from('profiles').select('id, name, avatar_equipped, xp, level, role');

      const profileMap = Object.fromEntries((profilesRaw || []).map((p: any) => [p.id, p]));
      const checkins = (checkinsRaw || []).map((c: any) => ({
        ...c,
        profiles: profileMap[c.user_id] || null
      }));

      // Frequency ranking for current month
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0,0,0,0);
      const { data: monthCheckins } = await supabase
        .from('checkins').select('user_id')
        .gte('date', firstDayOfMonth.toISOString().split('T')[0]);
      const freqCounts: Record<string, number> = {};
      (monthCheckins || []).forEach((c: any) => {
        freqCounts[c.user_id] = (freqCounts[c.user_id] || 0) + 1;
      });
      const freqTop = (profilesRaw || [])
        .map((p: any) => ({ ...p, freq: freqCounts[p.id] || 0 }))
        .filter((p: any) => p.freq > 0)
        .sort((a: any, b: any) => b.freq - a.freq)
        .slice(0, 3);
      setFreqRanking(freqTop);

      // Mocked stats for the ticker
      setData({
        settings: settings || { name: "CrossCity Hub", logo: "" },
        rewards: economy,
        wod: wod || null,
        checkins: checkins || [],
        challenges: challenges || [],
        duels: (duels || []).map((d: any) => ({
          ...d,
          challengerName: d.challenger?.name || 'Atleta',
          opponentName: d.opponent?.name || 'Atleta'
        })),
        rankings: rankings || []
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
    
    const rankingTabInterval = setInterval(() => {
      setRankingTab(prev => prev === 'xp' ? 'freq' : 'xp');
    }, 8000);

    const athleteInterval = setInterval(() => {
      setAthleteIndex(prev => {
        const athletesToDisplay = data?.checkins?.length > 0 
          ? data.checkins.map((c: any) => c.profiles).filter(Boolean)
          : data?.rankings || [];
        const count = athletesToDisplay.length || 1;
        return (prev + 1) % count;
      });
    }, 8000);

    let wodInterval: any;
    if (isWodAutoRotationActive) {
      wodInterval = setInterval(() => {
        setWodTabIndex(prev => (prev + 1) % 3);
      }, 15000);
    }

    const checkinsChannel = supabase.channel('tv-checkins')
      .on('postgres_changes', { event: '*', table: 'checkins' }, fetchData)
      .subscribe();

    return () => {
      clearInterval(interval);
      clearInterval(rankingTabInterval);
      clearInterval(athleteInterval);
      clearInterval(wodInterval);
      supabase.removeChannel(checkinsChannel);
    };
  }, [data?.rankings?.length, data?.checkins?.length, isWodAutoRotationActive]);

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
  
  if (!wod) {
    return (
      <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col p-6 gap-6 relative select-none">
        <header className="flex justify-between items-center bg-[#111] rounded-[2rem] p-6 border border-white/5 shadow-2xl">
          <div className="flex items-center gap-6">
            <img src={settings.logo || "https://picsum.photos/seed/box/200"} alt="Logo" className="w-16 h-16 rounded-2xl border-2 border-primary" />
            <div>
              <h1 className="text-4xl font-headline font-black text-white italic tracking-tighter uppercase leading-none">{settings.name}</h1>
              <p className="text-primary text-[10px] font-black tracking-[0.4em] uppercase italic mt-1">CROSSCITY HUB • PERFORMANCE ELITE</p>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">HORA ATUAL</span>
            <span className="text-4xl font-headline font-black text-white italic tabular-nums">{format(new Date(), 'HH:mm:ss')}</span>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#111] rounded-[3rem] border border-white/5">
          <Activity className="w-24 h-24 text-primary/20 mb-8" />
          <h2 className="text-6xl font-headline font-black text-white uppercase italic tracking-tighter mb-4">AGUARDANDO WOD</h2>
          <p className="text-white/40 text-xl font-black uppercase tracking-[0.4em] italic">NENHUM TREINO CADASTRADO PARA HOJE</p>
        </div>
      </div>
    );
  }

  const athletesToDisplay = checkins.length > 0 
    ? checkins.map((c: any) => c.profiles).filter(Boolean)
    : rankings;

  const athletesCount = athletesToDisplay?.length || 0;
  const currentAthlete = athletesCount > 0 ? athletesToDisplay[athleteIndex % athletesCount] : null;
  const nextAthlete = athletesCount > 1 ? athletesToDisplay[(athleteIndex + 1) % athletesCount] : null;

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
          {/* WOD Tabs Navigation */}
          <div className="flex items-center justify-between bg-[#111] rounded-3xl p-3 border border-white/5">
            <div className="flex gap-3">
              {['WARM-UP', 'SKILL', 'THE WOD'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setWodTabIndex(i)}
                  className={cn(
                    "px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] italic transition-all border relative overflow-hidden group",
                    wodTabIndex === i 
                      ? "bg-primary text-black border-primary shadow-[0_0_20px_rgba(202,253,0,0.3)]" 
                      : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                  )}
                >
                  <span className="relative z-10">{label}</span>
                  {wodTabIndex === i && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mr-2">
              <button 
                onClick={() => setIsWodAutoRotationActive(!isWodAutoRotationActive)}
                className={cn(
                  "p-3 rounded-xl border transition-all flex items-center gap-2",
                  isWodAutoRotationActive 
                    ? "bg-primary/20 border-primary/30 text-primary" 
                    : "bg-white/5 border-white/10 text-white/40"
                )}
                title={isWodAutoRotationActive ? "Pausar Rotação" : "Retomar Rotação"}
              >
                {isWodAutoRotationActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span className="text-[10px] font-black uppercase italic tracking-widest">
                  {isWodAutoRotationActive ? 'AUTO' : 'PAUSADO'}
                </span>
              </button>
              <button 
                onClick={() => setWodTabIndex(prev => (prev - 1 + 3) % 3)}
                className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setWodTabIndex(prev => (prev + 1) % 3)}
                className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              {wodTabIndex === 0 && (
                <motion.section 
                  key="warmup"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 bg-[#111] rounded-[3rem] p-12 border border-white/5 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <h3 className="text-primary text-sm font-black uppercase tracking-[0.4em] italic mb-2">PHASE 01</h3>
                      <h2 className="text-6xl font-headline font-black text-white uppercase italic tracking-tighter">WARM-UP</h2>
                    </div>
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Activity className="w-10 h-10 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-8">
                    {(wod?.warmup || '').split('\n').filter(Boolean).map((line: string, i: number) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-8"
                      >
                        <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_20px_#cafd00]"></div>
                        <p className="text-5xl font-headline font-black text-white uppercase italic tracking-tight leading-tight">{line}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {wodTabIndex === 1 && (
                <motion.section 
                  key="skill"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 bg-[#111] rounded-[3rem] p-12 border border-white/5 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <h3 className="text-secondary text-sm font-black uppercase tracking-[0.4em] italic mb-2">PHASE 02</h3>
                      <h2 className="text-6xl font-headline font-black text-white uppercase italic tracking-tighter">SKILL / TECHNIQUE</h2>
                    </div>
                    <div className="w-20 h-20 rounded-3xl bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                      <Zap className="w-10 h-10 text-secondary" />
                    </div>
                  </div>
                    <div className="flex-1 flex flex-col justify-center gap-8">
                      {(wod?.skill || '').split('\n').filter(Boolean).map((line: string, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-8"
                        >
                          <div className="w-4 h-4 rounded-full bg-secondary shadow-[0_0_20px_#ff7439]"></div>
                          <p className="text-5xl font-headline font-black text-white uppercase italic tracking-tight leading-tight">{line}</p>
                        </motion.div>
                      ))}
                    </div>
                </motion.section>
              )}

              {wodTabIndex === 2 && (
                <motion.section 
                  key="wod"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 bg-[#111] rounded-[3rem] p-12 border border-white/5 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-primary text-sm font-black uppercase tracking-[0.4em] italic mb-2">PHASE 03</h3>
                      <h2 className="text-6xl font-headline font-black text-white uppercase italic tracking-tighter">THE WOD</h2>
                    </div>
                    <div className="bg-primary text-black px-8 py-4 rounded-3xl font-headline font-black text-5xl italic uppercase tracking-tighter shadow-[0_0_30px_rgba(202,253,0,0.3)]">
                      {wod.type}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="text-center mb-12">
                      
                      <h2 className="text-[5rem] font-headline font-black text-white italic tracking-tighter uppercase leading-none mb-4">{wod.name}</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 text-left flex flex-col gap-2">
                        <span className="text-secondary text-xs font-black uppercase tracking-widest block mb-2">RX</span>
                        <span className="text-2xl font-headline font-black text-white italic leading-tight whitespace-pre-wrap">{wod.rx}</span>
                      </div>
                      <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 text-center">
                        <span className="text-white/40 text-xs font-black uppercase tracking-widest block mb-2">SCALED</span>
                        <span className="text-2xl font-headline font-black text-white italic leading-tight whitespace-pre-wrap">{wod.scaled}</span>
                      </div>
                      <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 text-center">
                        <span className="text-white/40 text-xs font-black uppercase tracking-widest block mb-2">BEGINNER</span>
                        <span className="text-4xl font-headline font-black text-white italic">{wod.beginner}</span>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: CHECK-IN & ATHLETE CARDS */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* TOP 3 RANKING */}
          <section className="bg-[#111] rounded-[2.5rem] p-5 border border-white/5 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <h3 className="text-base font-headline font-black text-white italic uppercase tracking-tight">TOP 3</h3>
              </div>
              <div className="flex gap-2">
                {(['xp', 'freq'] as const).map(tab => (
                  <button key={tab} onClick={() => setRankingTab(tab)}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${rankingTab === tab ? 'bg-primary text-black' : 'bg-white/5 text-white/40'}`}>
                    {tab === 'xp' ? 'XP MÊS' : 'FREQ'}
                  </button>
                ))}
              </div>
            </div>
            {(rankingTab === 'xp' ? (data?.rankings || []).slice(0,3) : freqRanking).map((r: any, i: number) => (
              <div key={r.id || i} className="flex items-center gap-3 bg-white/5 rounded-2xl px-3 py-2 border border-white/5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black
                  ${i===0?'bg-primary text-black':i===1?'bg-white/20 text-white':'bg-white/10 text-white/60'}`}>
                  {i+1}
                </span>
                <AvatarPreview equipped={r.avatar_equipped} size="xs" className="border border-white/10" />
                <p className="flex-1 text-white font-bold uppercase text-xs italic truncate">{r.name}</p>
                <p className="text-primary text-[10px] font-black shrink-0">
                  {rankingTab === 'xp' ? `${r.xp} XP` : `${r.freq} treinos`}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <p className="text-white/30 text-[8px] font-black uppercase tracking-widest">CHECK-INS HOJE</p>
              <p className="text-primary text-sm font-black">{checkins.length} <span className="text-white/30 text-[8px]">atletas</span></p>
            </div>
          </section>

          {/* ATLETAS NA AULA — Carrossel dinâmico */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 flex-1 relative overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-headline font-black text-white italic uppercase tracking-tight">ATLETAS NA AULA</h3>
              </div>
              <span className="bg-primary text-black px-2 py-0.5 rounded-full font-headline font-black text-xs italic">
                {checkins.length}
              </span>
            </div>

            {checkins.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-white/20 text-xs font-black uppercase tracking-widest italic text-center px-4">
                  Nenhum check-in<br/>registrado ainda
                </p>
              </div>
            ) : (
              <>
                {/* Avatar em destaque — atleta atual */}
                <AnimatePresence mode="wait">
                  {(() => {
                    const c = checkins[athleteIndex % checkins.length];
                    const profile = c?.profiles;
                    return (
                      <motion.div
                        key={athleteIndex}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.05, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center justify-center flex-1 gap-3 pb-2"
                      >
                        {/* Avatar grande com glow */}
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
                          <AvatarPreview
                            equipped={profile?.avatar_equipped}
                            size="xl"
                            className="relative border-4 border-primary shadow-[0_0_40px_rgba(202,253,0,0.4)]"
                          />
                          {/* Badge check-in */}
                          <div className="absolute -bottom-2 -right-2 bg-primary text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase italic shadow-lg">
                            ✓ CHECK-IN
                          </div>
                        </div>

                        {/* Nome e info */}
                        <div className="text-center px-4">
                          <h4 className="text-2xl font-headline font-black text-white uppercase italic tracking-tight leading-none">
                            {profile?.name?.split(' ')[0] || 'Atleta'}
                          </h4>
                          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">
                            {c?.class_time ? `Aula ${c.class_time}` : 'Check-in realizado'}
                          </p>
                        </div>

                        {/* Indicadores de paginação */}
                        <div className="flex gap-1.5 mt-1">
                          {checkins.slice(0, Math.min(checkins.length, 8)).map((_: any, i: number) => (
                            <div
                              key={i}
                              className={`rounded-full transition-all duration-300 ${
                                i === athleteIndex % checkins.length
                                  ? 'w-4 h-1.5 bg-primary'
                                  : 'w-1.5 h-1.5 bg-white/20'
                              }`}
                            />
                          ))}
                          {checkins.length > 8 && (
                            <span className="text-white/30 text-[8px] font-black">+{checkins.length - 8}</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Mini lista dos outros atletas */}
                <div className="border-t border-white/5 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {checkins.map((c: any, i: number) => {
                    const profile = c?.profiles;
                    const isActive = i === athleteIndex % checkins.length;
                    return (
                      <div
                        key={c.id}
                        className={`shrink-0 flex flex-col items-center gap-1 transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`}
                      >
                        <AvatarPreview
                          equipped={profile?.avatar_equipped}
                          size="sm"
                          className={`border-2 transition-all ${isActive ? 'border-primary shadow-[0_0_10px_rgba(202,253,0,0.4)]' : 'border-white/10'}`}
                        />
                        <span className="text-[7px] font-black text-white/60 uppercase truncate max-w-[40px]">
                          {profile?.name?.split(' ')[0] || '?'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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
                  <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">CHECK-INS HOJE:</span>
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{checkins.length} atletas</span>
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
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{rankings?.[0]?.name ? `${rankings[0].name.split(' ')[0].toUpperCase()} • ${rankings[0].xp} XP` : 'SEM DADOS'}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-white/20"></div>
                <div className="flex items-center gap-4">
                  <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">UPCOMING:</span>
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{wod?.name || 'WOD NÃO CADASTRADO'}</span>
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
