import { useState, useEffect, useCallback } from 'react';
import { Trophy, Zap, Calendar, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn, compareBy } from '../lib/utils';
import { User as UserType } from '../types';
import { motion } from 'framer-motion';
import ShareRankingButton from '../components/ShareRankingButton';
import AthletePhoto from '../components/AthletePhoto';
import { supabase } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import { calcInactivity, InactivitySettings } from '../utils/inactivity';

interface RankedUser extends UserType {
  monthXp?: number;
  monthCheckinCount?: number;
  allCheckins?: { date: string }[];
  photo_url?: string | null;
}

export default function Leaderboard() {
  const [xpAllTime, setXpAllTime]       = useState<RankedUser[]>([]);
  const [xpMonthly, setXpMonthly]       = useState<RankedUser[]>([]);
  const [freqRank, setFreqRank]         = useState<RankedUser[]>([]);
  const [clanRankings, setClanRankings] = useState<any[]>([]);
  const [wodRanking, setWodRanking]     = useState<any[]>([]);
  const [wodInfo, setWodInfo]           = useState<any>(null);
  const [activeTab, setActiveTab]       = useState<'xp_mes' | 'freq' | 'xp_total' | 'clans' | 'wod'>('xp_mes');
  const [isExpanded, setIsExpanded]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [inactivitySettings, setInactivitySettings] = useState<InactivitySettings | null>(null);
  const [boxName, setBoxName] = useState<string>('CrossCity Hub');
  const [boxLogo, setBoxLogo] = useState<string>('');
  const [checkinsByUser, setCheckinsByUser]          = useState<Record<string, { date: string }[]>>({});

  const now       = new Date();
  const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const fetchAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const now             = new Date(); // Recalculado a cada chamada — corrige bug do ranking WOD não atualizar
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const todayStr        = formatInTimeZone(now, 'America/Sao_Paulo', 'yyyy-MM-dd');

      // ── Todas as queries base em paralelo ─────────────────────────────────
      const [
        { data: allUsers,       error: usersError },
        { data: boxSettings },
        { data: rewardHistory },
        { data: checkinsMonth },
        { data: clansData },
        { data: eventsData },
        { data: membershipsData },
        { data: todayWod },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('status', 'approved'),
        supabase.from('box_settings').select('inactivity, name, logo').maybeSingle(),
        supabase.from('reward_history').select('user_id, xp').gte('created_at', firstDayOfMonth + 'T00:00:00'),
        supabase.from('checkins').select('user_id, date').gte('date', firstDayOfMonth),
        supabase.from('clans').select('*').eq('is_active', true),
        supabase.from('domination_events').select('clan_id, energy'),
        supabase.from('clan_memberships').select('clan_id').eq('status', 'approved'),
        supabase.from('wods').select('*').eq('date', todayStr).maybeSingle(),
      ]);

      if (usersError) throw usersError;

      // ── Configurações de inatividade ──────────────────────────────────────
      if (boxSettings?.name) setBoxName(boxSettings.name);
      if (boxSettings?.logo) setBoxLogo(boxSettings.logo);

      const inactSettings: InactivitySettings = boxSettings?.inactivity ||
        { enabled: false, mode: 'consecutive', startDays: 5, maxDays: 14 };
      setInactivitySettings(inactSettings);

      // ── Checkins para inatividade (query separada pois depende de inactSettings) ──
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (inactSettings.maxDays || 30));
      const { data: allCheckins } = await supabase
        .from('checkins').select('user_id, date')
        .gte('date', cutoff.toISOString().split('T')[0]);

      const checkinsMap: Record<string, { date: string }[]> = {};
      (allUsers || []).forEach((u: any) => { checkinsMap[u.id] = []; });
      (allCheckins || []).forEach((c: any) => {
        if (checkinsMap[c.user_id]) checkinsMap[c.user_id].push({ date: c.date });
      });
      setCheckinsByUser(checkinsMap);

      // ── Helpers ───────────────────────────────────────────────────────────
      const mapUser = (u: any, extra = {}): RankedUser => ({
        id: u.id, email: u.email, name: u.name ?? 'Atleta',
        role: u.role, status: u.status, xp: u.xp || 0,
        coins: u.coins || 0, level: u.level || 1,
        avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory || [] },
        checkins: [], paidBonuses: u.paid_bonuses || [],
        createdAt: u.created_at,
        allCheckins: checkinsMap[u.id] || [],
        photo_url: u.photo_url ?? null,
        ...extra,
      });

      const byLevelDesc = (a: RankedUser, b: RankedUser) => (b.level || 1) - (a.level || 1);
      const byXpDesc    = (a: RankedUser, b: RankedUser) => (b.xp || 0) - (a.xp || 0);
      const byAgeAsc    = (a: RankedUser, b: RankedUser) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      const byNameAsc   = (a: RankedUser, b: RankedUser) =>
        (a.name || '').localeCompare(b.name || '', 'pt-BR');

      // ── XP all time ───────────────────────────────────────────────────────
      setXpAllTime([...(allUsers || [])]
        .map(u => mapUser(u))
        .filter(u => (u.xp || 0) > 0)
        .sort(compareBy<RankedUser>((a, b) => (b.xp || 0) - (a.xp || 0), byLevelDesc, byAgeAsc, byNameAsc))
        .slice(0, 50));

      // ── XP mensal ─────────────────────────────────────────────────────────
      const monthXpByUser: Record<string, number> = {};
      (rewardHistory || []).forEach((r: any) => {
        if (r.xp > 0) monthXpByUser[r.user_id] = (monthXpByUser[r.user_id] || 0) + r.xp;
      });
      setXpMonthly([...(allUsers || [])]
        .map(u => mapUser(u, { monthXp: monthXpByUser[u.id] || 0 }))
        .filter(u => (u.monthXp || 0) > 0)
        .sort(compareBy<RankedUser>((a, b) => (b.monthXp || 0) - (a.monthXp || 0), byXpDesc, byLevelDesc, byAgeAsc, byNameAsc))
        .slice(0, 50));

      // ── Frequência ────────────────────────────────────────────────────────
      const checkinCounts: Record<string, number> = {};
      (checkinsMonth || []).forEach((c: any) => {
        checkinCounts[c.user_id] = (checkinCounts[c.user_id] || 0) + 1;
      });
      setFreqRank([...(allUsers || [])]
        .map(u => mapUser(u, { monthCheckinCount: checkinCounts[u.id] || 0 }))
        .filter(u => (u.monthCheckinCount || 0) > 0)
        .sort(compareBy<RankedUser>((a, b) => (b.monthCheckinCount || 0) - (a.monthCheckinCount || 0), byXpDesc, byLevelDesc, byAgeAsc, byNameAsc))
        .slice(0, 50));

      // ── Clãs ──────────────────────────────────────────────────────────────
      if (clansData) {
        setClanRankings(clansData.map(clan => ({
          ...clan,
          energy: (eventsData || []).filter(e => e.clan_id === clan.id).reduce((s, e) => s + e.energy, 0),
          memberCount: (membershipsData || []).filter(m => m.clan_id === clan.id).length,
        })).sort(compareBy<any>(
          (a, b) => (b.energy || 0) - (a.energy || 0),
          (a, b) => (b.memberCount || 0) - (a.memberCount || 0),
          (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
          (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'),
        )));
      }

      // ── WOD ───────────────────────────────────────────────────────────────
      let activeWod = todayWod;
      if (!activeWod) {
        const { data: latestWods } = await supabase.from('wods').select('*').order('date', { ascending: false }).limit(1);
        activeWod = latestWods?.[0] ?? null;
      }
      setWodInfo(activeWod);

      const parseResult = (r: string, timeBased: boolean): number => {
        if (!r) return timeBased ? 999999 : 0;
        const str = r.trim();
        if (/^\d+:\d+/.test(str)) {
          const p = str.split(':').map(Number);
          return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
        }
        return parseFloat(str.replace(/[^0-9.]/g, '')) || (timeBased ? 999999 : 0);
      };

      const processWodResults = (wodResults: any[], wodType: string) => {
        const isTimeBased = ['FOR TIME', 'TIME', 'TEMPO'].some(t => (wodType || '').toUpperCase().includes(t));
        const bestByUser: Record<string, any> = {};
        wodResults.forEach((r: any) => {
          const uid = r.user_id;
          const val = parseResult(r.result, isTimeBased);
          const prev = bestByUser[uid];
          if (!prev) { bestByUser[uid] = r; return; }
          const prevVal = parseResult(prev.result, isTimeBased);
          if (isTimeBased ? val < prevVal : val > prevVal) bestByUser[uid] = r;
        });
        return Object.values(bestByUser)
          .sort((a: any, b: any) => isTimeBased
            ? parseResult(a.result, isTimeBased) - parseResult(b.result, isTimeBased)
            : parseResult(b.result, isTimeBased) - parseResult(a.result, isTimeBased))
          .map((r: any) => ({ id: r.id, name: r.profiles?.name || 'Atleta', result: r.result, type: r.type, level: r.profiles?.level || 1 }));
      };

      if (activeWod) {
        // Busca por wod_id (principal) e por data de hoje como fallback
        // O fallback cobre casos em que o WOD exibido é de outro dia (ex: não há WOD hoje)
        // e o resultado foi gravado com wod_id correto mas created_at é de hoje.
        const { data: wodResults } = await supabase
          .from('wod_results').select('*, profiles(name, level)').eq('wod_id', activeWod.id);

        if (wodResults && wodResults.length > 0) {
          setWodRanking(processWodResults(wodResults, activeWod.type));
        } else {
          // Fallback: busca resultados com created_at de HOJE (timezone SP) — cobre registro no mesmo dia
          const todayStart = todayStr + 'T00:00:00-03:00';
          const todayEnd   = todayStr + 'T23:59:59-03:00';
          const { data: todayResults } = await supabase
            .from('wod_results').select('*, profiles(name, level)')
            .gte('created_at', todayStart).lte('created_at', todayEnd);
          setWodRanking(todayResults?.length ? processWodResults(todayResults, activeWod.type) : []);
        }
      } else {
        setWodRanking([]);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Realtime só para mudanças relevantes — sem polling
    const channel = supabase.channel('leaderboard_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wod_results' }, () => fetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wods' }, () => fetchAll(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const getInactivity = (u: RankedUser) => {
    if (!inactivitySettings) return { fadePercent: 0, showSleeping: false };
    return calcInactivity(u.allCheckins || [], inactivitySettings);
  };

  const isClans = activeTab === 'clans';
  const isWod   = activeTab === 'wod';

  const currentRank = activeTab === 'xp_total' ? xpAllTime
    : activeTab === 'xp_mes'  ? xpMonthly
    : activeTab === 'freq'    ? freqRank
    : activeTab === 'wod'     ? wodRanking
    : clanRankings;

  const top3   = currentRank.slice(0, 3);
  const others = currentRank.slice(3);

  const getScore = (u: any) => {
    if (activeTab === 'xp_total') return `${u.xp} XP`;
    if (activeTab === 'xp_mes')   return `${u.monthXp || 0} XP`;
    if (activeTab === 'freq')     return `${u.monthCheckinCount || 0} check-ins`;
    if (activeTab === 'clans')    return `${u.energy || 0} ⚡`;
    if (activeTab === 'wod')      return u.result || '';
    return '';
  };

  if (error) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-error font-headline font-black text-xl italic p-4 text-center">
      <p>ERRO AO CARREGAR</p>
      <button onClick={() => fetchAll()} className="mt-4 bg-primary text-background px-6 py-2 rounded-xl text-sm font-black">TENTAR NOVAMENTE</button>
    </div>
  );
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO...</div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" /> RANKING
          {refreshing && <span className="text-xs font-sans font-normal text-on-surface-variant animate-pulse normal-case tracking-normal">atualizando...</span>}
        </h1>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
            <Calendar className="w-3 h-3" /> {monthName}
          </div>
          {!isWod && top3.length > 0 && (
            <ShareRankingButton
              top3={top3 as any}
              rankingType={activeTab === 'xp_mes' || activeTab === 'xp_total' ? 'xp' : activeTab === 'freq' ? 'freq' : 'clans'}
              title={activeTab === 'xp_mes' ? 'XP DO MÊS' : activeTab === 'freq' ? 'FREQUÊNCIA' : activeTab === 'xp_total' ? 'XP TOTAL' : 'TIMES'}
              boxName={boxName}
              boxLogo={boxLogo}
              monthName={monthName}
            />
          )}
        </div>
      </header>

      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 gap-1 overflow-x-auto no-scrollbar">
        {([
          { key: 'xp_mes',   label: 'XP MÊS' },
          { key: 'freq',     label: 'FREQUÊNCIA' },
          { key: 'wod',      label: 'RANK WOD' },
          { key: 'clans',    label: 'TIMES' },
          { key: 'xp_total', label: 'XP TOTAL' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn("flex-1 min-w-[70px] py-3 rounded-xl font-headline font-bold text-[9px] uppercase tracking-widest transition-all",
              activeTab === key ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}>{label}</button>
        ))}
      </div>

      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest -mt-3">
        {activeTab === 'xp_mes'   && `XP ganho em ${monthName} — reinicia todo mês`}
        {activeTab === 'freq'     && `Check-ins de ${monthName} — só quem treinou`}
        {activeTab === 'xp_total' && 'XP acumulado desde o início'}
        {activeTab === 'clans'    && 'Energia acumulada pelos times'}
        {activeTab === 'wod'      && `Resultados do WOD — ${wodInfo?.name || 'sem WOD cadastrado'}`}
      </p>

      {isWod && (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-4 flex flex-col gap-1">
          {wodInfo ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">WOD de Hoje</p>
                  <p className="text-sm font-headline font-black text-primary uppercase italic">{wodInfo.name} — {wodInfo.type}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    {['FOR TIME', 'TIME', 'TEMPO'].some(t => (wodInfo.type || '').toUpperCase().includes(t))
                      ? '⏱ Menor tempo = melhor resultado' : '🔁 Maior número = melhor resultado'}
                  </p>
                </div>
                <button onClick={() => fetchAll(true)} disabled={refreshing}
                  className="text-[9px] font-black uppercase tracking-widest text-primary border border-primary/30 px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-all disabled:opacity-40">
                  {refreshing ? '...' : '↻ Atualizar'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-1">Nenhum WOD cadastrado para hoje</p>
          )}
        </div>
      )}

      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-4 pt-8 pb-4">
          {top3[1] && (() => {
            const { fadePercent } = !isClans && !isWod ? getInactivity(top3[1] as RankedUser) : { fadePercent: 0 };
            return (
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <AthletePhoto photoUrl={!isClans && !isWod ? (top3[1] as RankedUser).photo_url : null}
                    name={top3[1].name || 'A'} size="md" fadePercent={fadePercent}
                    ringColor="border-outline-variant/30" className="w-16 h-16" />
                  <div className="absolute -top-2 -right-2 bg-outline-variant/40 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#2</div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">
                    {isClans ? top3[1].name : top3[1].name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-bold">{getScore(top3[1])}</p>
                </div>
                <div className="w-16 h-20 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-on-surface-variant italic">
                    {isClans ? `${(top3[1] as any).memberCount} mbr` : `LVL ${top3[1].level}`}
                  </span>
                </div>
              </div>
            );
          })()}

          {top3[0] && (() => {
            const { fadePercent } = !isClans && !isWod ? getInactivity(top3[0] as RankedUser) : { fadePercent: 0 };
            return (
              <div className="flex flex-col items-center gap-2 -mt-8">
                <div className="relative">
                  <AthletePhoto photoUrl={!isClans && !isWod ? (top3[0] as RankedUser).photo_url : null}
                    name={top3[0].name || 'A'} size="lg" fadePercent={fadePercent}
                    ringColor="border-primary" className="w-24 h-24 shadow-[0_0_30px_rgba(202,253,0,0.3)]" />
                  <div className="absolute -top-3 -right-3 bg-primary text-background text-xs font-black px-3 py-1 rounded-full shadow-lg">#1</div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-headline font-black text-primary uppercase italic truncate max-w-[100px]">
                    {isClans ? top3[0].name : top3[0].name.split(' ')[0]}
                  </p>
                  <p className="text-xs text-on-surface font-bold">{getScore(top3[0])}</p>
                </div>
                <div className="w-24 h-32 bg-primary/10 rounded-t-3xl border-x border-t border-primary/20 flex items-center justify-center">
                  <span className="text-xs font-black text-primary italic">
                    {isClans ? `${(top3[0] as any).memberCount} mbr` : `LVL ${top3[0].level}`}
                  </span>
                </div>
              </div>
            );
          })()}

          {top3[2] && (() => {
            const { fadePercent } = !isClans && !isWod ? getInactivity(top3[2] as RankedUser) : { fadePercent: 0 };
            return (
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <AthletePhoto photoUrl={!isClans && !isWod ? (top3[2] as RankedUser).photo_url : null}
                    name={top3[2].name || 'A'} size="md" fadePercent={fadePercent}
                    ringColor="border-secondary/30" className="w-16 h-16" />
                  <div className="absolute -top-2 -right-2 bg-secondary/30 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#3</div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">
                    {isClans ? top3[2].name : top3[2].name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-bold">{getScore(top3[2])}</p>
                </div>
                <div className="w-16 h-16 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-on-surface-variant italic">
                    {isClans ? `${(top3[2] as any).memberCount} mbr` : `LVL ${top3[2].level}`}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {isWod && wodRanking.length === 0 && wodInfo && (
        <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-4 italic">
          Nenhum resultado registrado ainda
        </p>
      )}

      {currentRank.length > 3 && (
        <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">
              {isClans ? 'TODOS OS TIMES' : isWod ? 'TODOS OS RESULTADOS' : 'TODOS ATLETAS'}
            </h3>
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary text-xs font-bold flex items-center gap-1">
              {isExpanded ? 'RECOLHER' : 'EXPANDIR'} {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div className={cn("space-y-3 transition-all duration-500 overflow-hidden", isExpanded ? "max-h-[2000px]" : "max-h-[300px]")}>
            {others.map((u, i) => {
              const { fadePercent } = !isClans && !isWod ? getInactivity(u as RankedUser) : { fadePercent: 0 };
              return (
                <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 4}</span>
                    <AthletePhoto
                      photoUrl={!isClans && !isWod ? (u as RankedUser).photo_url : null}
                      name={u.name || '?'} size="sm" fadePercent={fadePercent}
                      ringColor="border-outline-variant/10" />
                    <div>
                      <p className="text-on-surface font-bold uppercase text-sm italic">{u.name}</p>
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                        {isClans
                          ? <><Users className="w-3 h-3" /> {(u as any).memberCount} membros</>
                          : isWod
                          ? <span className="text-[10px] font-bold uppercase">{u.type} • Nível {u.level}</span>
                          : <><Zap className="w-3 h-3 text-primary" /> Nível {u.level}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-on-surface font-headline font-black text-sm italic">{getScore(u)}</p>
                    {activeTab === 'xp_mes' && <p className="text-on-surface-variant text-[9px] font-bold">Total: {u.xp} XP</p>}
                  </div>
                </motion.div>
              );
            })}
            {others.length === 0 && (
              <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-4 italic">
                {currentRank.length <= 3 ? `Apenas ${currentRank.length} no ranking` : 'Nenhum resultado'}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
                                    }
