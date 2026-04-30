import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [rankingView, setRankingView] = useState<'xp' | 'frequency'>('xp');
  const [athleteIndex, setAthleteIndex] = useState(0);
  const [wodTabIndex, setWodTabIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Relógio em tempo real
  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");

      // Fetch all data in parallel
      const [
        { data: settings },
        { data: economy },
        { data: wod },
        { data: challenges },
        { data: duels },
        { data: rankings },
        { data: scheduleData }
      ] = await Promise.all([
        supabase.from('box_settings').select('*').maybeSingle(),
        supabase.from('avatar_economy_settings').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('wods').select('*').eq('date', today).maybeSingle(),
        supabase.from('challenges').select('*').eq('active', true),
        supabase.from('duels').select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)').eq('status', 'accepted'),
        supabase.from('profiles').select('name, xp, level, avatar_equipped').eq('status', 'approved').order('xp', { ascending: false }).limit(10),
        supabase.from('schedule').select('*').order('time', { ascending: true })
      ]);

      // Determinar aula atual com base no horário
      const nowStr = formatInTimeZone(new Date(), TIMEZONE, 'HH:mm');
      const currentClass = (scheduleData || []).find((s: any) => {
        return nowStr >= s.time && nowStr <= (s.end_time || s.endTime || '23:59');
      });

      const { data: checkinsRaw } = await supabase
        .from('checkins').select('*')
        .gte('date', today)
        .order('timestamp', { ascending: false })
        .limit(20);

      const { data: profilesRaw } = await supabase
        .from('profiles').select('id, name, avatar_equipped, xp, level, role');

      const profileMap = Object.fromEntries((profilesRaw || []).map((p: any) => [p.id, p]));

      // Fetch monthly check-ins for frequency ranking
      const startOfMonth = format(new Date(), 'yyyy-MM-01');
      const { data: monthlyCheckins } = await supabase
        .from('checkins')
        .select('user_id')
        .gte('date', startOfMonth);

      const freqMap: Record<string, number> = {};
      (monthlyCheckins || []).forEach(c => {
        freqMap[c.user_id] = (freqMap[c.user_id] || 0) + 1;
      });

      const frequencyRanking = Object.entries(freqMap)
        .map(([userId, count]) => ({
          ...(profileMap[userId] || { name: 'Atleta' }),
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const allCheckins = (checkinsRaw || []).map((c: any) => ({
        ...c,
        profiles: profileMap[c.user_id] || null
      }));

      // Filtrar apenas quem está na aula atual
      const checkins = currentClass
        ? allCheckins.filter((c: any) => c.class_time === currentClass.time)
        : allCheckins;

      // Stats reais para o ticker
      const stats = {
        checkins: checkins.length,
        topPlayer: rankings?.[0] ? `${rankings[0].name.split(' ')[0].toUpperCase()} • ${rankings[0].xp} XP` : null,
        wod: wod?.name || null
      };

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
        rankings: rankings || [],
        stats,
        frequencyRanking
      });
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('TV Fetch Error:', err);
      setError(err.message);
    }
  }, []);

  // Ref para count de atletas — evita recriar intervals quando dados mudam
  const athleteCountRef = useRef(0);
  useEffect(() => {
    const count = data?.checkins?.length > 0
      ? data.checkins.map((c: any) => c.profiles).filter(Boolean).length
      : data?.rankings?.length || 0;
    athleteCountRef.current = count;
  }, [data?.checkins?.length, data?.rankings?.length]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    
    // Carrossel de atletas usando ref (sem recriar interval)
    const athleteInterval = setInterval(() => {
      setAthleteIndex(prev => {
        const count = athleteCountRef.current || 1;
        return (prev + 1) % count;
      });
    }, 4000);

    const rankingInterval = setInterval(() => {
      setRankingView(prev => prev === 'xp' ? 'frequency' : 'xp');
    }, 10000);

    let realtimeChannel: ReturnType<typeof supabase.channel>;
    const subscribeRealtime = () => {
      realtimeChannel = supabase
        .channel('tv-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[TV] Canal realtime perdido, reconectando em 5s...');
            supabase.removeChannel(realtimeChannel);
            setTimeout(subscribeRealtime, 5000);
          }
        });
    };
    subscribeRealtime();

    return () => {
      clearInterval(interval);
      clearInterval(athleteInterval);
      clearInterval(rankingInterval);
      supabase.removeChannel(realtimeChannel);
    };
  }, [fetchData]);

  // Rotação automática do WOD — separado para reagir a isWodAutoRotationActive
  useEffect(() => {
    if (!isWodAutoRotationActive) return;
    const wodInterval = setInterval(() => {
      setWodTabIndex(prev => (prev + 1) % 3);
    }, 15000);
    return () => clearInterval(wodInterval);
  }, [isWodAutoRotationActive]);

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

  const { wod, checkins, settings, rankings, stats, duels, frequencyRanking } = data;
  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > 60000;
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
            <span className="text-4xl font-headline font-black text-white italic tabular-nums">{format(now, 'HH:mm:ss')}</span>
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
            <span className="text-4xl font-headline font-black text-white italic tabular-nums">{format(now, 'HH:mm:ss')}</span>
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
          {isStale ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-yellow-400 text-[9px] font-black uppercase tracking-widest animate-pulse">⚠ SEM ATUALIZAÇÃO</span>
              <button onClick={fetchData} className="text-yellow-400/70 text-[8px] font-black uppercase tracking-wider hover:text-yellow-400 transition-colors">
                RECONECTAR
              </button>
            </div>
          ) : lastUpdated ? (
            <div className="flex flex-col items-center">
              <span className="text-green-400/60 text-[8px] font-black uppercase tracking-widest">● AO VIVO</span>
              <span className="text-white/20 text-[7px] font-black uppercase">{format(lastUpdated, 'HH:mm:ss')}</span>
            </div>
          ) : null}
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
                  {/* Header compacto */}
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-3xl font-headline font-black text-white uppercase italic tracking-tighter">{wod.name}</h2>
                    <div className="bg-primary text-black px-6 py-2 rounded-2xl font-headline font-black text-xl italic uppercase tracking-tight">
                      {wod.type}
                    </div>
                  </div>

                  {/* RX — ocupa todo o espaço com fonte adaptável */}
                  <div className="flex-1 bg-secondary/10 border-2 border-secondary/40 rounded-[2rem] p-8 flex flex-col overflow-hidden">
                    <span className="text-secondary text-lg font-black uppercase tracking-widest mb-4 shrink-0">🔴 RX</span>
                    <p className="text-white font-headline font-black italic leading-snug whitespace-pre-wrap overflow-hidden"
                      style={{
                        fontSize: wod.rx && wod.rx.length > 200 ? '1.5rem' : wod.rx && wod.rx.length > 100 ? '2rem' : '2.5rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 10,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                      {wod.rx}
                    </p>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: CHECK-IN & ATHLETE CARDS */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* TOP 3 RANKING — Pódio */}
          <section className="bg-[#111] rounded-[2.5rem] p-5 border border-white/5 flex flex-col gap-3" style={{flex: '2 1 0'}}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <h3 className="text-base font-headline font-black text-white italic uppercase tracking-tight">TOP 3</h3>
              </div>
              <div className="flex gap-2">
                {(['xp', 'frequency'] as const).map(tab => (
                  <button key={tab} onClick={() => setRankingView(tab)}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${rankingView === tab ? 'bg-primary text-black' : 'bg-white/5 text-white/40'}`}>
                    {tab === 'xp' ? 'XP MÊS' : 'FREQ'}
                  </button>
                ))}
              </div>
            </div>

            {/* Pódio */}
            <AnimatePresence mode="wait">
              <motion.div
                key={rankingView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-end justify-between gap-2 px-2 pb-1"
              >
                {/* 2º */}
                {(rankingView === 'xp' ? rankings : frequencyRanking)[1] && (() => {
                  const r = (rankingView === 'xp' ? rankings : frequencyRanking)[1];
                  return (
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center font-headline font-black text-white text-lg">{r.name?.[0]}</div>
                      <p className="text-white/80 text-[9px] font-black uppercase italic truncate max-w-full text-center">{r.name?.split(' ')[0]}</p>
                      <p className="text-white/50 text-[8px] font-bold">{rankingView === 'xp' ? `${r.xp} XP` : `${r.count} aulas`}</p>
                      <div className="w-full h-8 bg-white/10 rounded-t-lg flex items-center justify-center">
                        <span className="text-white/60 text-xs font-black">#2</span>
                      </div>
                    </div>
                  );
                })()}
                {/* 1º */}
                {(rankingView === 'xp' ? rankings : frequencyRanking)[0] && (() => {
                  const r = (rankingView === 'xp' ? rankings : frequencyRanking)[0];
                  return (
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center font-headline font-black text-primary text-xl shadow-[0_0_15px_rgba(202,253,0,0.4)]">{r.name?.[0]}</div>
                      <p className="text-primary text-[10px] font-black uppercase italic truncate max-w-full text-center">{r.name?.split(' ')[0]}</p>
                      <p className="text-primary text-[9px] font-black">{rankingView === 'xp' ? `${r.xp} XP` : `${r.count} aulas`}</p>
                      <div className="w-full h-12 bg-primary/20 border border-primary/30 rounded-t-lg flex items-center justify-center">
                        <span className="text-primary text-sm font-black">👑 #1</span>
                      </div>
                    </div>
                  );
                })()}
                {/* 3º */}
                {(rankingView === 'xp' ? rankings : frequencyRanking)[2] && (() => {
                  const r = (rankingView === 'xp' ? rankings : frequencyRanking)[2];
                  return (
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-9 h-9 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center font-headline font-black text-white/60 text-base">{r.name?.[0]}</div>
                      <p className="text-white/50 text-[9px] font-black uppercase italic truncate max-w-full text-center">{r.name?.split(' ')[0]}</p>
                      <p className="text-white/40 text-[8px] font-bold">{rankingView === 'xp' ? `${r.xp} XP` : `${r.count} aulas`}</p>
                      <div className="w-full h-6 bg-white/5 rounded-t-lg flex items-center justify-center">
                        <span className="text-white/40 text-[9px] font-black">#3</span>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </AnimatePresence>

            {/* 4º e 5º lugar */}
            <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
              {(rankingView === 'xp' ? rankings : frequencyRanking).slice(3, 5).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-[9px] font-black w-4">#{i + 4}</span>
                    <span className="text-white/60 text-[10px] font-black uppercase truncate max-w-[100px]">{r.name?.split(' ')[0]}</span>
                  </div>
                  <span className="text-white/40 text-[9px] font-black">
                    {rankingView === 'xp' ? `${r.xp} XP` : `${r.count} aulas`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ATLETAS NA AULA — Carrossel dinâmico — compacto */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 relative overflow-hidden flex flex-col" style={{flex: '1 1 0'}}>
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
                {/* Avatar em destaque — tamanho médio */}
                <AnimatePresence mode="wait">
                  {(() => {
                    const c = checkins[athleteIndex % checkins.length];
                    const profile = c?.profiles;
                    return (
                      <motion.div
                        key={athleteIndex}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.05, y: -10 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center gap-4 px-5 py-3 flex-1"
                      >
                        {/* Avatar md com glow */}
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
                          <AvatarPreview
                            equipped={profile?.avatar_equipped}
                            size="md"
                            className="relative border-4 border-primary shadow-[0_0_20px_rgba(202,253,0,0.4)]"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-primary text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase italic shadow">
                            ✓
                          </div>
                        </div>

                        {/* Nome e info */}
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xl font-headline font-black text-white uppercase italic tracking-tight leading-none truncate">
                            {profile?.name?.split(' ')[0] || 'Atleta'}
                          </h4>
                          <p className="text-primary text-[9px] font-black uppercase tracking-widest mt-1">
                            {c?.class_time ? `Aula ${c.class_time}` : 'Check-in realizado'}
                          </p>
                          {/* Indicadores */}
                          <div className="flex gap-1 mt-2">
                            {checkins.slice(0, Math.min(checkins.length, 8)).map((_: any, i: number) => (
                              <div
                                key={i}
                                className={`rounded-full transition-all duration-300 ${
                                  i === athleteIndex % checkins.length
                                    ? 'w-3 h-1.5 bg-primary'
                                    : 'w-1.5 h-1.5 bg-white/20'
                                }`}
                              />
                            ))}
                            {checkins.length > 8 && (
                              <span className="text-white/30 text-[8px] font-black ml-1">+{checkins.length - 8}</span>
                            )}
                          </div>
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
                        className={`shrink-0 flex flex-col items-center gap-0.5 transition-all ${isActive ? 'opacity-100' : 'opacity-35'}`}
                      >
                        <AvatarPreview
                          equipped={profile?.avatar_equipped}
                          size="sm"
                          className={`border-2 transition-all ${isActive ? 'border-primary shadow-[0_0_8px_rgba(202,253,0,0.4)]' : 'border-white/10'}`}
                        />
                        <span className="text-[7px] font-black text-white/60 uppercase truncate max-w-[36px] text-center">
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
                  <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.checkins} atletas</span>
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

                {stats.topPlayer && (
                  <>
                    <div className="flex items-center gap-4">
                      <span className="text-secondary text-[10px] font-black uppercase tracking-widest italic">LÍDER XP:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.topPlayer}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </>
                )}

                {stats.wod && (
                  <>
                    <div className="flex items-center gap-4">
                      <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">WOD:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.wod}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </>
                )}
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
