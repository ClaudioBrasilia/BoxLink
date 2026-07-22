import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Trophy, Zap, Swords, Maximize, Activity, Users, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, Challenge, Duel, User, BoxSettings } from '../types';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { getWodByDate, getLatestWod } from '../lib/wods';
import { cn } from '../lib/utils';
import AvatarPreview from '../components/AvatarPreview';
import { calcInactivity, InactivitySettings } from '../utils/inactivity';
import AthletePhoto from '../components/AthletePhoto';
import { TVSponsorBanner, useSponsors } from '../components/SponsorBanner';

const TIMEZONE = "America/Sao_Paulo";

// ─── Painel de Frequência Cardíaca ───────────────────────────────────────────
interface AthleteHR { user_id: string; bpm: number; updated_at: string; name?: string; photo_url?: string | null; }

function getHRZone(bpm: number) {
  if (bpm < 100) return { label: 'REPOUSO',     color: '#60a5fa', bar: 'bg-blue-400',   glow: 'rgba(96,165,250,0.5)' };
  if (bpm < 120) return { label: 'AQUECIMENTO', color: '#4ade80', bar: 'bg-green-400',  glow: 'rgba(74,222,128,0.5)' };
  if (bpm < 140) return { label: 'AERÓBICO',    color: '#facc15', bar: 'bg-yellow-400', glow: 'rgba(250,204,21,0.5)' };
  if (bpm < 160) return { label: 'ANAERÓBICO',  color: '#fb923c', bar: 'bg-orange-400', glow: 'rgba(251,146,60,0.5)' };
  return               { label: 'MÁXIMO ⚡',    color: '#f87171', bar: 'bg-red-400',    glow: 'rgba(248,113,113,0.6)' };
}

function TVHeartRatePanel() {
  const [athletes, setAthletes] = useState<AthleteHR[]>([]);
  const fetchHR = useCallback(async () => {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: hrData } = await supabase.from('heart_rate_live').select('user_id, bpm, updated_at').gte('updated_at', cutoff).order('bpm', { ascending: false });
    if (!hrData || hrData.length === 0) { setAthletes([]); return; }
    const ids = hrData.map((r: any) => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, name, photo_url').in('id', ids);
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    setAthletes(hrData.map((r: any) => ({ ...r, name: profileMap[r.user_id]?.name || 'Atleta', photo_url: profileMap[r.user_id]?.photo_url || null })));
  }, []);

  useEffect(() => {
    fetchHR();
    const channel = supabase.channel('tv-heart-rate').on('postgres_changes', { event: '*', schema: 'public', table: 'heart_rate_live' }, fetchHR).subscribe();
    const interval = setInterval(fetchHR, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [fetchHR]);

  if (athletes.length === 0) return null;
  return (
    <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-400 animate-pulse" />
          <h3 className="text-sm font-headline font-black text-white italic uppercase tracking-tight">FC AO VIVO</h3>
        </div>
        <span className="bg-red-500/20 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full font-headline font-black text-[10px] italic">
          {athletes.length} relógio{athletes.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {athletes.map((athlete) => {
            const zone = getHRZone(athlete.bpm);
            const pct  = Math.min(100, Math.max(0, ((athlete.bpm - 50) / 150) * 100));
            const firstName = athlete.name?.split(' ')[0] || 'Atleta';
            return (
              <motion.div key={athlete.user_id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-headline font-black text-xs"
                      style={{ backgroundColor: zone.color + '20', border: `1px solid ${zone.color}40`, color: zone.color }}>
                      {athlete.photo_url
                        ? <img src={athlete.photo_url} alt={firstName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                        : firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black text-[10px] uppercase italic truncate leading-none">{firstName}</p>
                      <p className="text-[8px] font-black uppercase tracking-wider mt-0.5" style={{ color: zone.color }}>{zone.label}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-0.5 shrink-0">
                    <motion.span key={athlete.bpm} initial={{ scale: 1.3, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
                      className="font-headline font-black text-xl italic tabular-nums"
                      style={{ color: zone.color, textShadow: `0 0 16px ${zone.glow}` }}>
                      {athlete.bpm}
                    </motion.span>
                    <span className="text-[8px] font-black uppercase" style={{ color: zone.color }}>BPM</span>
                  </div>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${zone.bar}`} style={{ boxShadow: `0 0 6px ${zone.glow}` }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── TV Principal ─────────────────────────────────────────────────────────────
export default function TV() {
  const sponsors = useSponsors();
  const [data, setData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWodAutoRotationActive, setIsWodAutoRotationActive] = useState(true);
  const [rankingView, setRankingView] = useState<'xp' | 'frequency'>('xp');
  const [athleteIndex, setAthleteIndex] = useState(0);
  const [wodTabIndex, setWodTabIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
      const [
        { data: settings }, { data: economy }, wod,
        { data: challenges }, { data: duels }, { data: scheduleData }
      ] = await Promise.all([
        supabase.from('box_settings').select('*').maybeSingle(),
        supabase.from('avatar_economy_settings').select('*').eq('is_active', true).maybeSingle(),
        getWodByDate(today),
        supabase.from('challenges').select('*').eq('active', true).or(`end_date.is.null,end_date.gte.${today}`),
        supabase.from('duels').select('*').in('status', ['active', 'accepted']),
        supabase.from('schedule').select('*').order('time', { ascending: true })
      ]);

      const nowStr = formatInTimeZone(new Date(), TIMEZONE, 'HH:mm');
      const currentClass = (scheduleData || []).find((s: any) => nowStr >= s.time && nowStr <= (s.end_time || s.endTime || '23:59'));
      const { data: checkinsRaw } = await supabase.from('checkins').select('*').gte('date', today).order('timestamp', { ascending: false }).limit(20);
      const { data: profilesRaw } = await supabase.from('profiles').select('id, name, avatar_equipped, xp, level, role, photo_url');
      const profileMap = Object.fromEntries((profilesRaw || []).map((p: any) => [p.id, p]));

      const inactivitySettings: InactivitySettings = settings?.inactivity ||
        { enabled: false, minWorkoutsPerWeek: 3, excludeSunday: true, showOnTV: false };
      const showInactiveOnTV = !!inactivitySettings.enabled && !!inactivitySettings.showOnTV;

      const inactivityByUser: Record<string, { fadePercent: number; showSleeping: boolean }> = {};
      if (showInactiveOnTV) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 8); // janela móvel de 7 dias + margem de timezone
        const { data: recentCheckins } = await supabase
          .from('checkins').select('user_id, date')
          .gte('date', cutoff.toISOString().split('T')[0]);
        const checkinsByUser: Record<string, { date: string }[]> = {};
        (recentCheckins || []).forEach((c: any) => {
          if (!checkinsByUser[c.user_id]) checkinsByUser[c.user_id] = [];
          checkinsByUser[c.user_id].push({ date: c.date });
        });
        Object.keys(profileMap).forEach((id) => {
          const state = calcInactivity(checkinsByUser[id] || [], inactivitySettings);
          inactivityByUser[id] = { fadePercent: state.fadePercent, showSleeping: state.showSleeping };
        });
      }

      const startOfMonth = format(new Date(), 'yyyy-MM-01');

      const { data: monthlyXpRaw } = await supabase
        .from('reward_history')
        .select('user_id, xp')
        .gte('created_at', `${startOfMonth}T00:00:00.000Z`);

      const xpMonthMap: Record<string, number> = {};
      (monthlyXpRaw || []).forEach((r: any) => {
        if (r.xp > 0) xpMonthMap[r.user_id] = (xpMonthMap[r.user_id] || 0) + r.xp;
      });
      const rankings = Object.entries(xpMonthMap)
        .map(([userId, monthXp]) => ({ ...(profileMap[userId] || { name: 'Atleta' }), xp: monthXp }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10);

      const { data: monthlyCheckins } = await supabase.from('checkins').select('user_id').gte('date', startOfMonth);
      const freqMap: Record<string, number> = {};
      (monthlyCheckins || []).forEach(c => { freqMap[c.user_id] = (freqMap[c.user_id] || 0) + 1; });
      const frequencyRanking = Object.entries(freqMap)
        .map(([userId, count]) => ({ ...(profileMap[userId] || { name: 'Atleta' }), count }))
        .sort((a, b) => b.count - a.count).slice(0, 5);

      const allCheckins = (checkinsRaw || []).map((c: any) => ({
        ...c,
        profiles: profileMap[c.user_id] || null,
        inactivity: inactivityByUser[c.user_id] || null,
      }));
      const checkins = currentClass ? allCheckins.filter((c: any) => c.class_time === currentClass.time) : allCheckins;
      const stats = {
        checkins: checkins.length,
        topPlayer: frequencyRanking?.[0]
          ? `${frequencyRanking[0].name.split(' ')[0].toUpperCase()} • ${frequencyRanking[0].count} CHECK-INS`
          : null,
        wod: wod?.name || null
      };

      let activeWod = wod;
      if (!activeWod) {
        activeWod = await getLatestWod(today);
      }

      const rawTvConfig = settings?.tv_config || settings?.tvConfig || {};
      const tvConfig = {
        ...rawTvConfig,
        tickerItems: {
          duels: rawTvConfig?.tickerItems?.duels ?? true,
          checkins: rawTvConfig?.tickerItems?.checkins ?? true,
          topPlayer: rawTvConfig?.tickerItems?.topPlayer ?? true,
          wod: rawTvConfig?.tickerItems?.wod ?? true,
          announcements: rawTvConfig?.tickerItems?.announcements ?? true,
          challenges: rawTvConfig?.tickerItems?.challenges ?? true,
        }
      };

      // Mapear nomes dos atletas para os duelos (suporta formato antigo e novo, com múltiplos oponentes)
      const mappedDuels = (duels || []).map((d: any) => {
        const challenger = profileMap[d.challenger_id];

        // Suporte para múltiplos oponentes (novo formato) ou único (antigo)
        const opponentIds = d.opponent_ids || (d.opponent_id ? [d.opponent_id] : []);
        const opponentNames = opponentIds
          .map((id: string) => profileMap[id]?.name?.split(' ')[0] || 'Atleta')
          .join(' & ');

        return {
          ...d,
          challengerName: challenger?.name || 'Atleta',
          opponentName: opponentNames || 'Oponente'
        };
      });

      setData({
        settings: settings || { name: "BoxLink", logo: "" },
        tvConfig, rewards: economy, wod: activeWod || null, checkins: checkins || [],
        challenges: challenges || [],
        duels: mappedDuels,
        rankings: rankings || [], stats, frequencyRanking,
        announcements: settings?.announcements || [],
      });
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('TV Fetch Error:', err);
      setError(err.message);
    }
  }, []);

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
    const athleteInterval = setInterval(() => {
      setAthleteIndex(prev => { const count = athleteCountRef.current || 1; return (prev + 1) % count; });
    }, 4000);
    const rankingInterval = setInterval(() => {
      setRankingView(prev => prev === 'xp' ? 'frequency' : 'xp');
    }, 10000);

    let realtimeChannel: ReturnType<typeof supabase.channel>;
    const subscribeRealtime = () => {
      realtimeChannel = supabase.channel('tv-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchData())
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            supabase.removeChannel(realtimeChannel);
            setTimeout(subscribeRealtime, 5000);
          }
        });
    };
    subscribeRealtime();
    return () => { clearInterval(interval); clearInterval(athleteInterval); clearInterval(rankingInterval); supabase.removeChannel(realtimeChannel); };
  }, [fetchData]);

  useEffect(() => {
    if (!isWodAutoRotationActive) return;
    const wodInterval = setInterval(() => { setWodTabIndex(prev => (prev + 1) % 3); }, 15000);
    return () => clearInterval(wodInterval);
  }, [isWodAutoRotationActive]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  if (error && !data) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-red-500 font-headline font-black text-2xl italic p-8 text-center">
      <p>ERRO DE CONEXÃO COM A ARENA</p>
      <p className="text-sm mt-4 text-white/60 font-sans not-italic">{error}</p>
      <button onClick={fetchData} className="mt-8 bg-primary text-black px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-transform">
        TENTAR RECONECTAR
      </button>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-primary font-headline font-black text-4xl italic animate-pulse">
      PREPARANDO ARENA...
    </div>
  );

  const { wod, checkins, settings, rankings, stats, duels, challenges, frequencyRanking, tvConfig, announcements } = data;
  const tickerItems = {
    duels: tvConfig?.tickerItems?.duels ?? true,
    checkins: tvConfig?.tickerItems?.checkins ?? true,
    topPlayer: tvConfig?.tickerItems?.topPlayer ?? true,
    wod: tvConfig?.tickerItems?.wod ?? true,
    announcements: tvConfig?.tickerItems?.announcements ?? true,
    challenges: tvConfig?.tickerItems?.challenges ?? true,
  };

  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > 60000;

  // ── Normaliza avisos: aceita string pura, objeto, ou string JSON serializada ──
  const normalizedAnnouncements = (announcements || [])
    .map((a: any) => {
      if (typeof a === 'string') {
        try {
          const parsed = JSON.parse(a);
          return parsed; // era string JSON
        } catch {
          return { title: a, content: '', active: true }; // string pura
        }
      }
      return a; // já é objeto
    })
    .filter((a: any) => a && a.active !== false && a.title);

  const getWodFontSize = (text: string) => {
    const len = (text || '').length;
    const lines = (text || '').split('\n').filter(Boolean).length;
    if (len > 400 || lines > 10) return '1.3rem';
    if (len > 300 || lines > 7)  return '1.6rem';
    if (len > 200 || lines > 5)  return '2rem';
    if (len > 100 || lines > 3)  return '2.6rem';
    return '3.2rem';
  };

  const getListFontSize = (text: string) => {
    const lines = (text || '').split('\n').filter(Boolean).length;
    if (lines > 10) return '1rem';
    if (lines > 7)  return '1.3rem';
    if (lines > 5)  return '1.7rem';
    if (lines > 3)  return '2.2rem';
    return '2.6rem';
  };

  const getListGap = (text: string) => {
    const lines = (text || '').split('\n').filter(Boolean).length;
    if (lines > 8) return 'gap-2';
    if (lines > 5) return 'gap-4';
    return 'gap-6';
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col p-6 gap-6 relative select-none">

      {/* ── HEADER ── */}
      <header className="flex justify-between items-center bg-[#111] rounded-[2rem] p-6 border border-white/5 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="relative">
            <img src={settings.logo || "https://picsum.photos/seed/box/200"} alt="Logo" className="w-16 h-16 rounded-2xl border-2 border-primary shadow-[0_0_20px_rgba(202,253,0,0.3)]" />
            <div className="absolute -bottom-2 -right-2 bg-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase italic">ELITE</div>
          </div>
          <div>
            <h1 className="text-4xl font-headline font-black text-white italic tracking-tighter uppercase leading-none">{settings.name}</h1>
            <p className="text-primary text-[10px] font-black tracking-[0.4em] uppercase italic mt-1">BOXLINK • PERFORMANCE ELITE</p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1 tabular-nums leading-none"
            style={{ textShadow: '0 0 30px rgba(202,253,0,0.25)' }}>
            <span className="text-6xl font-headline font-black text-white italic tracking-tighter">
              {formatInTimeZone(now, TIMEZONE, 'HH:mm')}
            </span>
            <span className="text-primary text-4xl font-headline font-black italic animate-pulse">:</span>
            <span className="text-4xl font-headline font-black text-white/70 italic tracking-tighter">
              {formatInTimeZone(now, TIMEZONE, 'ss')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isStale && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-yellow-400 text-[9px] font-black uppercase tracking-widest animate-pulse">⚠ SEM ATUALIZAÇÃO</span>
              <button onClick={fetchData} className="text-yellow-400/70 text-[8px] font-black uppercase tracking-wider hover:text-yellow-400 transition-colors">RECONECTAR</button>
            </div>
          )}
          <TVSponsorBanner sponsors={sponsors} className="h-20" />
          <button onClick={toggleFullscreen} className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-primary hover:text-black transition-all group">
            <Maximize className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        <div className="col-span-8 flex flex-col gap-6">

          {wod && (
            <div className="flex items-center justify-between bg-[#111] rounded-3xl p-3 border border-white/5">
              <div className="flex gap-3">
                {['WARM-UP', 'SKILL', 'THE WOD'].map((label, i) => (
                  <button key={label} onClick={() => setWodTabIndex(i)}
                    className={cn(
                      "px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] italic transition-all border relative overflow-hidden",
                      wodTabIndex === i
                        ? "bg-primary text-black border-primary shadow-[0_0_20px_rgba(202,253,0,0.3)]"
                        : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                    )}>
                    <span className="relative z-10">{label}</span>
                    {wodTabIndex === i && (
                      <motion.div layoutId="activeTab" className="absolute inset-0 bg-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsWodAutoRotationActive(!isWodAutoRotationActive)}
                className={cn("p-3 rounded-xl border transition-all flex items-center gap-2 mr-2",
                  isWodAutoRotationActive ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/40")}>
                <span className="text-[10px] font-black uppercase italic tracking-widest">
                  {isWodAutoRotationActive ? 'AUTO' : 'PAUSADO'}
                </span>
              </button>
            </div>
          )}

          <div className="flex-1 relative">
            {!wod && (
              <div className="absolute inset-0 bg-[#111] rounded-[3rem] border border-white/5 flex flex-col items-center justify-center gap-4">
                <Activity className="w-20 h-20 text-primary/20" />
                <h2 className="text-5xl font-headline font-black text-white uppercase italic tracking-tighter">AGUARDANDO WOD</h2>
                <p className="text-white/30 text-sm font-black uppercase tracking-[0.3em] italic">Nenhum treino cadastrado para hoje</p>
              </div>
            )}
            <AnimatePresence mode="wait">
              {wodTabIndex === 0 && (
                <motion.section key="warmup"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 bg-[#111] rounded-[3rem] p-12 border border-white/5 flex flex-col">
                  <div className="flex justify-end items-start mb-8 shrink-0">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Activity className="w-10 h-10 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className={`flex-1 flex flex-col justify-start ${getListGap(wod?.warmup)} min-h-0 overflow-hidden`}>
                    {(wod?.warmup || '').split('\n').filter(Boolean).map((line: string, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="flex items-center gap-6 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_20px_#cafd00] shrink-0"></div>
                        <p className="font-headline font-black text-white uppercase italic tracking-tight leading-tight"
                          style={{ fontSize: getListFontSize(wod?.warmup) }}>{line}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {wodTabIndex === 1 && (
                <motion.section key="skill"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 bg-[#111] rounded-[3rem] p-12 border border-white/5 flex flex-col">
                  <div className="flex justify-end items-start mb-8 shrink-0">
                    <div className="w-20 h-20 rounded-3xl bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
                      <Zap className="w-10 h-10 text-secondary" />
                    </div>
                  </div>
                  <div className={`flex-1 flex flex-col justify-start ${getListGap(wod?.skill)} min-h-0 overflow-hidden`}>
                    {(wod?.skill || '').split('\n').filter(Boolean).map((line: string, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="flex items-center gap-6 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-secondary shadow-[0_0_20px_#ff7439] shrink-0"></div>
                        <p className="font-headline font-black text-white uppercase italic tracking-tight leading-tight"
                          style={{ fontSize: getListFontSize(wod?.skill) }}>{line}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {wodTabIndex === 2 && (
                <motion.section key="wod"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 bg-[#111] rounded-[3rem] p-8 border border-white/5 flex flex-col gap-4">
                  <div className="flex items-center justify-between shrink-0">
                    <div>
                      <h2 className="text-4xl font-headline font-black text-white uppercase italic tracking-tighter leading-none">{wod.name}</h2>
                    </div>
                    <div className="bg-primary text-black px-6 py-2 rounded-2xl font-headline font-black text-xl italic uppercase tracking-tight shrink-0">
                      {wod.type}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col min-h-0 bg-white/5 border border-white/10 rounded-[2rem] p-6 overflow-hidden">
                    <span className="text-primary text-sm font-black uppercase tracking-widest mb-3 shrink-0">RX</span>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                      <p className="text-white font-headline font-black italic leading-relaxed whitespace-pre-wrap"
                        style={{ fontSize: getWodFontSize(wod.rx) }}>{wod.rx}</p>
                    </div>
                  </div>
                  {wod.scaled && (
                    <div className="shrink-0 max-h-[30%] flex flex-col bg-white/5 border border-white/10 rounded-[2rem] p-5">
                      <span className="text-white/40 text-xs font-black uppercase tracking-widest mb-2 shrink-0 block">SCALED</span>
                      <div className="flex-1 overflow-y-auto no-scrollbar">
                        <p className="text-white/70 font-headline font-black italic leading-snug whitespace-pre-wrap"
                          style={{ fontSize: getWodFontSize(wod.scaled) }}>{wod.scaled}</p>
                      </div>
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="col-span-4 flex flex-col gap-6 overflow-y-auto no-scrollbar">

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

            <AnimatePresence mode="wait">
              <motion.div key={rankingView}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex items-end justify-between gap-2 px-2 pb-1">
                {(rankingView === 'xp' ? rankings : frequencyRanking)[1] && (() => {
                  const r = (rankingView === 'xp' ? rankings : frequencyRanking)[1];
                  return (
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <AthletePhoto photoUrl={r.photo_url} name={r.name || '?'} size="sm" ringColor="border-white/20" className="w-10 h-10" />
                      <p className="text-white/80 text-[9px] font-black uppercase italic truncate max-w-full text-center">{r.name?.split(' ')[0]}</p>
                      <p className="text-white/50 text-[8px] font-bold">{rankingView === 'xp' ? `${r.xp} XP` : `${r.count} aulas`}</p>
                      <div className="w-full h-8 bg-white/10 rounded-t-lg flex items-center justify-center">
                        <span className="text-white/60 text-xs font-black">#2</span>
                      </div>
                    </div>
                  );
                })()}
                {(rankingView === 'xp' ? rankings : frequencyRanking)[0] && (() => {
                  const r = (rankingView === 'xp' ? rankings : frequencyRanking)[0];
                  return (
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <AthletePhoto photoUrl={r.photo_url} name={r.name || '?'} size="md" ringColor="border-primary" className="w-12 h-12 shadow-[0_0_15px_rgba(202,253,0,0.4)]" />
                      <p className="text-primary text-[10px] font-black uppercase italic truncate max-w-full text-center">{r.name?.split(' ')[0]}</p>
                      <p className="text-primary text-[9px] font-black">{rankingView === 'xp' ? `${r.xp} XP` : `${r.count} aulas`}</p>
                      <div className="w-full h-12 bg-primary/20 border border-primary/30 rounded-t-lg flex items-center justify-center">
                        <span className="text-primary text-sm font-black">👑 #1</span>
                      </div>
                    </div>
                  );
                })()}
                {(rankingView === 'xp' ? rankings : frequencyRanking)[2] && (() => {
                  const r = (rankingView === 'xp' ? rankings : frequencyRanking)[2];
                  return (
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <AthletePhoto photoUrl={r.photo_url} name={r.name || '?'} size="sm" ringColor="border-white/10" className="w-9 h-9" />
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

          <TVHeartRatePanel />

          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 relative overflow-hidden flex flex-col" style={{flex: '1 1 0'}}>
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
                  Nenhum check-in registrado ainda
                </p>
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  {(() => {
                    const c = checkins[athleteIndex % checkins.length];
                    const profile = c?.profiles;
                    return (
                      <motion.div key={athleteIndex}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.05, y: -10 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center gap-4 px-5 py-3 flex-1">
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
                          <AvatarPreview equipped={profile?.avatar_equipped} size="md"
                            fadePercent={c?.inactivity?.fadePercent} showSleeping={c?.inactivity?.showSleeping}
                            className="relative border-4 border-primary shadow-[0_0_20px_rgba(202,253,0,0.4)]" />
                          <div className="absolute -bottom-1 -right-1 bg-primary text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase italic shadow">✓</div>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xl font-headline font-black text-white uppercase italic tracking-tight leading-none truncate">
                            {profile?.name?.split(' ')[0] || 'Atleta'}
                          </h4>
                          <p className="text-primary text-[9px] font-black uppercase tracking-widest mt-1">
                            {c?.class_time ? `Aula ${c.class_time}` : 'Check-in realizado'}
                          </p>
                          <div className="flex gap-1 mt-2">
                            {checkins.slice(0, Math.min(checkins.length, 8)).map((_: any, i: number) => (
                              <div key={i} className={`rounded-full transition-all duration-300 ${i === athleteIndex % checkins.length ? 'w-3 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-white/20'}`} />
                            ))}
                            {checkins.length > 8 && <span className="text-white/30 text-[8px] font-black ml-1">+{checkins.length - 8}</span>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                <div className="border-t border-white/5 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {checkins.map((c: any, i: number) => {
                    const profile = c?.profiles;
                    const isActive = i === athleteIndex % checkins.length;
                    return (
                      <div key={c.id} className={`shrink-0 flex flex-col items-center gap-0.5 transition-all ${isActive ? 'opacity-100' : 'opacity-35'}`}>
                        <AvatarPreview equipped={profile?.avatar_equipped} size="sm"
                          fadePercent={c?.inactivity?.fadePercent} showSleeping={c?.inactivity?.showSleeping}
                          className={`border-2 transition-all ${isActive ? 'border-primary shadow-[0_0_8px_rgba(202,253,0,0.4)]' : 'border-white/10'}`} />
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

      <footer className="h-16 bg-[#111] rounded-2xl border border-white/5 overflow-hidden flex items-center relative">
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-24 animate-marquee whitespace-nowrap items-center">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-24 items-center">
                {tickerItems.wod && wod && (
                  <>
                    <div className="flex items-center gap-4">
                      <Timer className="w-4 h-4 text-primary" />
                      <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">WOD:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{wod.name} • {wod.type}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </>
                )}
                {tickerItems.checkins && checkins.length > 0 && (
                  <>
                    <div className="flex items-center gap-4">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">CHECK-INS:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{checkins.length} atleta{checkins.length !== 1 ? 's' : ''} na aula</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </>
                )}
                {tickerItems.duels && duels?.map((d: any) => (
                  <React.Fragment key={d.id}>
                    <div className="flex items-center gap-4">
                      <Swords className="w-4 h-4 text-secondary" />
                      <span className="text-secondary text-[10px] font-black uppercase tracking-widest italic">DUELO:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{d.challengerName} <span className="text-white/30 mx-2">VS</span> {d.opponentName}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </React.Fragment>
                ))}
                {tickerItems.topPlayer && stats.topPlayer && (
                  <>
                    <div className="flex items-center gap-4">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-primary text-[10px] font-black uppercase tracking-widest italic">LÍDER CHECK-INS:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{stats.topPlayer}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </>
                )}
                {tickerItems.announcements && normalizedAnnouncements.map((a: any, idx: number) => (
                  <React.Fragment key={a.id || `ann-${idx}`}>
                    <div className="flex items-center gap-4">
                      <span className="text-yellow-400 text-[10px] font-black uppercase tracking-widest italic">📢 AVISO:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{a.title}</span>
                      {a.content && <span className="text-white/50 text-base font-black italic tracking-tight">{a.content}</span>}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </React.Fragment>
                ))}
                {tickerItems.challenges && challenges && challenges.length > 0 && challenges.map((c: any) => (
                  <React.Fragment key={c.id}>
                    <div className="flex items-center gap-4">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 text-[10px] font-black uppercase tracking-widest italic">DESAFIO:</span>
                      <span className="text-xl font-headline font-black text-white uppercase italic tracking-tight">{c.name || c.title || 'Desafio sem nome'}</span>
                      {c.description && <span className="text-white/50 text-base font-black italic tracking-tight">{c.description}</span>}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </React.Fragment>
                ))}
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
