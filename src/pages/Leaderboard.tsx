import { useState, useEffect } from 'react';
import { Trophy, Zap, Calendar, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { User as UserType } from '../types';
import { motion } from 'framer-motion';
import ShareRankingButton from '../components/ShareRankingButton';
import { supabase } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';

interface RankedUser extends UserType {
  monthXp?: number;
  monthCheckinCount?: number;
}

export default function Leaderboard() {
  const [xpAllTime, setXpAllTime] = useState<RankedUser[]>([]);
  const [xpMonthly, setXpMonthly] = useState<RankedUser[]>([]);
  const [freqRank, setFreqRank] = useState<RankedUser[]>([]);
  const [clanRankings, setClanRankings] = useState<any[]>([]);
  const [wodRanking, setWodRanking] = useState<any[]>([]);
  const [wodInfo, setWodInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'xp_mes' | 'freq' | 'xp_total' | 'clans' | 'wod'>('xp_mes');
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('leaderboard_wod')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wod_results' }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const todayStr = formatInTimeZone(now, 'America/Sao_Paulo', 'yyyy-MM-dd');

      // 1. Perfis aprovados
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles').select('*').eq('status', 'approved');
      if (usersError) throw usersError;

      const mapUser = (u: any, extra = {}): RankedUser => ({
        id: u.id, email: u.email, name: u.name ?? 'Atleta',
        role: u.role, status: u.status, xp: u.xp || 0,
        coins: u.coins || 0, level: u.level || 1,
        avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory || [] },
        checkins: [], paidBonuses: u.paid_bonuses || [],
        createdAt: u.created_at, ...extra
      });

      // 2. XP total
      setXpAllTime([...(allUsers || [])]
        .map(u => mapUser(u))
        .filter(u => (u.xp || 0) > 0)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 50));

      // 3. XP do mês via reward_history
      const { data: rewardHistory } = await supabase
        .from('reward_history').select('user_id, xp')
        .gte('created_at', firstDayOfMonth + 'T00:00:00');
      const monthXpByUser: Record<string, number> = {};
      (rewardHistory || []).forEach((r: any) => {
        if (r.xp > 0) monthXpByUser[r.user_id] = (monthXpByUser[r.user_id] || 0) + r.xp;
      });
      setXpMonthly([...(allUsers || [])]
        .map(u => mapUser(u, { monthXp: monthXpByUser[u.id] || 0 }))
        .filter(u => (u.monthXp || 0) > 0)
        .sort((a, b) => (b.monthXp || 0) - (a.monthXp || 0))
        .slice(0, 50));

      // 4. Frequência do mês
      const { data: checkinsData } = await supabase
        .from('checkins').select('user_id').gte('date', firstDayOfMonth);
      const checkinCounts: Record<string, number> = {};
      (checkinsData || []).forEach((c: any) => {
        checkinCounts[c.user_id] = (checkinCounts[c.user_id] || 0) + 1;
      });
      setFreqRank([...(allUsers || [])]
        .map(u => mapUser(u, { monthCheckinCount: checkinCounts[u.id] || 0 }))
        .filter(u => (u.monthCheckinCount || 0) > 0)
        .sort((a, b) => (b.monthCheckinCount || 0) - (a.monthCheckinCount || 0)).slice(0, 50));

      // 5. Times ranking
      const { data: clansData } = await supabase.from('clans').select('*').eq('is_active', true);
      const { data: eventsData } = await supabase.from('domination_events').select('clan_id, energy');
      const { data: membershipsData } = await supabase.from('clan_memberships').select('clan_id').eq('status', 'approved');
      if (clansData) {
        setClanRankings(clansData.map(clan => ({
          ...clan,
          energy: (eventsData || []).filter(e => e.clan_id === clan.id).reduce((s, e) => s + e.energy, 0),
          memberCount: (membershipsData || []).filter(m => m.clan_id === clan.id).length,
        })).sort((a, b) => b.energy - a.energy));
      }

      // 6. WOD do dia (ALTERAÇÃO AQUI - usando a função RPC)
      const { data: activeWodData, error: wodError } = await supabase
        .rpc('get_active_wod', { target_date: todayStr })
        .limit(1)
        .maybeSingle();
      if (wodError) console.error('Erro ao buscar WOD:', wodError);

      const activeWod = activeWodData || null;
      setWodInfo(activeWod);

      if (activeWod) {
        const { data: wodResults } = await supabase
          .from('wod_results').select('*, profiles(name, level)')
          .eq('wod_id', activeWod.id);
        if (wodResults && wodResults.length > 0) {
          const isTimeBased = ['FOR TIME', 'TIME', 'TEMPO'].some(t => (activeWod.type || '').toUpperCase().includes(t));
          const parseResult = (r: string): number => {
            if (!r) return isTimeBased ? 999999 : 0;
            const str = r.trim();
            // MM:SS or HH:MM:SS
            if (/^\d+:\d+/.test(str)) {
              const p = str.split(':').map(Number);
              return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
            }
            // Pure number (seconds or reps)
            return parseFloat(str.replace(/[^0-9.]/g, '')) || (isTimeBased ? 999999 : 0);
          };
          // Deduplica: pega melhor resultado por usuário
          const bestByUser: Record<string, any> = {};
          wodResults.forEach((r: any) => {
            const uid = r.user_id;
            const val = parseResult(r.result);
            const prev = bestByUser[uid];
            if (!prev) { bestByUser[uid] = r; return; }
            const prevVal = parseResult(prev.result);
            const isBetter = isTimeBased ? val < prevVal : val > prevVal;
            if (isBetter) bestByUser[uid] = r;
          });
          const deduped = Object.values(bestByUser);
          setWodRanking(deduped.sort((a: any, b: any) =>
            isTimeBased ? parseResult(a.result) - parseResult(b.result) : parseResult(b.result) - parseResult(a.result)
          ).map((r: any) => ({
            id: r.id, name: r.profiles?.name || 'Atleta',
            result: r.result, type: r.type, level: r.profiles?.level || 1,
          })));
        } else { setWodRanking([]); }
      } else { setWodRanking([]); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const isClans = activeTab === 'clans';
  const isWod = activeTab === 'wod';
  const currentRank = activeTab === 'xp_total' ? xpAllTime : activeTab === 'xp_mes' ? xpMonthly : activeTab === 'freq' ? freqRank : clanRankings;
  const top3 = currentRank.slice(0, 3);
  const others = currentRank.slice(3);

  const getScore = (u: any) => {
    if (activeTab === 'xp_total') return `${u.xp} XP`;
    if (activeTab === 'xp_mes') return `${u.monthXp || 0} XP`;
    if (activeTab === 'freq') return `${u.monthCheckinCount || 0} check-ins`;
    if (activeTab === 'clans') return `${u.energy || 0} ⚡`;
    return '';
  };

  if (error) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-error font-headline font-black text-xl italic p-4 text-center">
      <p>ERRO AO CARREGAR</p>
      <button onClick={fetchAll} className="mt-4 bg-primary text-background px-6 py-2 rounded-xl text-sm font-black">TENTAR NOVAMENTE</button>
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
        </h1>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
            <Calendar className="w-3 h-3" /> {monthName}
          </div>
          {!isWod && top3.length > 0 && (
            <ShareRankingButton
              top3={top3 as any}
              rankingType={activeTab === 'xp_mes' || activeTab === 'xp_total' ? 'xp' : activeTab === 'freq' ? 'freq' : 'clans'}
              title={
                activeTab === 'xp_mes' ? 'XP DO MÊS' :
                activeTab === 'freq' ? 'FREQUÊNCIA' :
                activeTab === 'xp_total' ? 'XP TOTAL' : 'TIMES'
              }
            />
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 gap-1 overflow-x-auto no-scrollbar">
        {([
          { key: 'xp_mes', label: 'XP MÊS' },
          { key: 'freq', label: 'FREQUÊNCIA' },
          { key: 'wod', label: 'RANK WOD' },
          { key: 'clans', label: 'TIMES' },
          { key: 'xp_total', label: 'XP TOTAL' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn("flex-1 min-w-[70px] py-3 rounded-xl font-headline font-bold text-[9px] uppercase tracking-widest transition-all",
              activeTab === key ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}>{label}</button>
        ))}
      </div>

      {/* Subtítulo */}
      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest -mt-3">
        {activeTab === 'xp_mes' && `XP ganho em ${monthName} — reinicia todo mês`}
        {activeTab === 'freq' && `Check-ins de ${monthName} — só quem treinou`}
        {activeTab === 'xp_total' && 'XP acumulado desde o início'}
        {activeTab === 'clans' && 'Energia acumulada pelos times'}
        {activeTab === 'wod' && `Resultados do WOD de hoje — ${wodInfo?.name || 'sem WOD cadastrado'}`}
      </p>

      {/* WOD Tab */}
      {isWod && (
        <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 flex flex-col gap-4">
          {wodInfo && (
            <div className="bg-surface-container-highest/30 rounded-2xl p-3">
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">WOD de Hoje</p>
              <p className="text-sm font-headline font-black text-primary uppercase italic">{wodInfo.name} — {wodInfo.type}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">
                {['FOR TIME', 'TIME', 'TEMPO'].some(t => (wodInfo.type || '').toUpperCase().includes(t))
                  ? '⏱ Menor tempo = melhor resultado'
                  : '🔁 Maior número = melhor resultado'}
              </p>
            </div>
          )}
          {!wodInfo && <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-4">Nenhum WOD cadastrado para hoje</p>}
          {wodRanking.length === 0 && wodInfo && (
            <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-4 italic">Nenhum resultado registrado ainda</p>
          )}
          {wodRanking.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3">
                <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 1}</span>
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-headline font-black text-sm",
                  i === 0 ? "bg-primary text-background" : i === 1 ? "bg-outline-variant/40 text-on-surface" : i === 2 ? "bg-secondary/30 text-on-surface" : "bg-surface-container-highest text-on-surface")}>
                  {r.name[0]}
                </div>
                <div>
                  <p className="text-on-surface font-bold uppercase text-sm italic">{r.name}</p>
                  <p className="text-on-surface-variant text-[10px] font-bold uppercase">{r.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary font-headline font-black text-sm italic">{r.result}</p>
                <p className="text-on-surface-variant text-[9px] font-bold">Nível {r.level}</p>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {/* Pódio — não mostra no WOD */}
      {!isWod && (
        <div className="flex items-end justify-center gap-4 pt-8 pb-4">
          {top3[1] && (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-outline-variant/30 bg-surface-container-highest flex items-center justify-center font-headline font-black text-xl text-on-surface">
                  {isClans ? (top3[1].name?.[0] || 'T') : top3[1].name[0]}
                </div>
                <div className="absolute -top-2 -right-2 bg-outline-variant/40 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#2</div>
              </div>
              <div className="text-center">
                <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{isClans ? top3[1].name : top3[1].name.split(' ')[0]}</p>
                <p className="text-[10px] text-on-surface-variant font-bold">{getScore(top3[1])}</p>
              </div>
              <div className="w-16 h-20 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
                <span className="text-[10px] font-black text-on-surface-variant italic">{isClans ? `${top3[1].memberCount} mbr` : `LVL ${top3[1].level}`}</span>
              </div>
            </div>
          )}
          {top3[0] && (
            <div className="flex flex-col items-center gap-2 -mt-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-primary bg-surface-container-highest shadow-[0_0_30px_rgba(202,253,0,0.3)] flex items-center justify-center font-headline font-black text-3xl text-primary">
                  {isClans ? (top3[0].name?.[0] || 'T') : top3[0].name[0]}
                </div>
                <div className="absolute -top-3 -right-3 bg-primary text-background text-xs font-black px-3 py-1 rounded-full shadow-lg">#1</div>
              </div>
              <div className="text-center">
                <p className="text-sm font-headline font-black text-primary uppercase italic truncate max-w-[100px]">{isClans ? top3[0].name : top3[0].name.split(' ')[0]}</p>
                <p className="text-xs text-on-surface font-bold">{getScore(top3[0])}</p>
              </div>
              <div className="w-24 h-32 bg-primary/10 rounded-t-3xl border-x border-t border-primary/20 flex items-center justify-center">
                <span className="text-xs font-black text-primary italic">{isClans ? `${top3[0].memberCount} mbr` : `LVL ${top3[0].level}`}</span>
              </div>
            </div>
          )}
          {top3[2] && (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-secondary/30 bg-surface-container-highest flex items-center justify-center font-headline font-black text-xl text-on-surface">
                  {isClans ? (top3[2].name?.[0] || 'T') : top3[2].name[0]}
                </div>
                <div className="absolute -top-2 -right-2 bg-secondary/30 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#3</div>
              </div>
              <div className="text-center">
                <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{isClans ? top3[2].name : top3[2].name.split(' ')[0]}</p>
                <p className="text-[10px] text-on-surface-variant font-bold">{getScore(top3[2])}</p>
              </div>
              <div className="w-16 h-16 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
                <span className="text-[10px] font-black text-on-surface-variant italic">{isClans ? `${top3[2].memberCount} mbr` : `LVL ${top3[2].level}`}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {!isWod && (
        <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">
              {isClans ? 'TODOS OS TIMES' : 'TODOS ATLETAS'}
            </h3>
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary text-xs font-bold flex items-center gap-1">
              {isExpanded ? 'RECOLHER' : 'EXPANDIR'} {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div className={cn("space-y-3 transition-all duration-500 overflow-hidden", isExpanded ? "max-h-[2000px]" : "max-h-[300px]")}>
            {others.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/30 transition-all">
                <div className="flex items-center gap-4">
                  <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 4}</span>
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-sm border border-outline-variant/10">
                    {(u.name || '?')[0]}
                  </div>
                  <div>
                    <p className="text-on-surface font-bold uppercase text-sm italic">{u.name}</p>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      {isClans ? <><Users className="w-3 h-3" /> {(u as any).memberCount} membros</> : <><Zap className="w-3 h-3 text-primary" /> Nível {u.level}</>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-on-surface font-headline font-black text-sm italic">{getScore(u)}</p>
                  {activeTab === 'xp_mes' && <p className="text-on-surface-variant text-[9px] font-bold">Total: {u.xp} XP</p>}
                </div>
              </motion.div>
            ))}
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
