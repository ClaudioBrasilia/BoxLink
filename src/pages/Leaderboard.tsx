import { useState, useEffect } from 'react';
import { Trophy, Zap, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { User as UserType } from '../types';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface RankedUser extends UserType {
  monthXp?: number;
  monthCheckinCount?: number;
}

export default function Leaderboard() {
  const [xpAllTime, setXpAllTime] = useState<RankedUser[]>([]);
  const [xpMonthly, setXpMonthly] = useState<RankedUser[]>([]);
  const [freqRank, setFreqRank] = useState<RankedUser[]>([]);
  const [activeTab, setActiveTab] = useState<'xp_mes' | 'freq' | 'xp_total'>('xp_mes');
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];

  useEffect(() => { fetchRankings(); }, []);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // 1. Todos os perfis aprovados
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'approved');
      if (usersError) throw usersError;

      const mapUser = (u: any, extra = {}): RankedUser => ({
        id: u.id, email: u.email, name: u.name ?? 'Atleta',
        role: u.role, status: u.status, xp: u.xp || 0,
        coins: u.coins || 0, level: u.level || 1,
        avatar: { equipped: u.avatar_equipped, inventory: u.avatar_inventory || [] },
        checkins: [], paidBonuses: u.paid_bonuses || [],
        createdAt: u.created_at, ...extra
      });

      // 2. XP total acumulado
      const sortedXpTotal = [...(allUsers || [])]
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 50).map(u => mapUser(u));
      setXpAllTime(sortedXpTotal);

      // 3. XP do mês — soma reward_history do mês atual
      const { data: rewardHistory } = await supabase
        .from('reward_history')
        .select('user_id, xp')
        .gte('created_at', firstDayOfMonth + 'T00:00:00');

      const monthXpByUser: Record<string, number> = {};
      (rewardHistory || []).forEach((r: any) => {
        if (r.xp > 0) monthXpByUser[r.user_id] = (monthXpByUser[r.user_id] || 0) + r.xp;
      });

      const sortedXpMonthly = [...(allUsers || [])]
        .map(u => mapUser(u, { monthXp: monthXpByUser[u.id] || 0 }))
        .sort((a, b) => (b.monthXp || 0) - (a.monthXp || 0))
        .slice(0, 50);
      setXpMonthly(sortedXpMonthly);

      // 4. Frequência do mês — check-ins
      const { data: checkinsData } = await supabase
        .from('checkins').select('user_id')
        .gte('date', firstDayOfMonth);

      const checkinCounts: Record<string, number> = {};
      (checkinsData || []).forEach((c: any) => {
        checkinCounts[c.user_id] = (checkinCounts[c.user_id] || 0) + 1;
      });

      const sortedFreq = [...(allUsers || [])]
        .map(u => mapUser(u, { monthCheckinCount: checkinCounts[u.id] || 0 }))
        .sort((a, b) => (b.monthCheckinCount || 0) - (a.monthCheckinCount || 0))
        .slice(0, 50);
      setFreqRank(sortedFreq);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentRank =
    activeTab === 'xp_total' ? xpAllTime :
    activeTab === 'xp_mes' ? xpMonthly : freqRank;

  const getScore = (u: RankedUser) => {
    if (activeTab === 'xp_total') return `${u.xp} XP`;
    if (activeTab === 'xp_mes') return `${u.monthXp || 0} XP`;
    return `${u.monthCheckinCount || 0} check-ins`;
  };

  const top3 = currentRank.slice(0, 3);
  const others = currentRank.slice(3);

  if (error) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-error font-headline font-black text-xl italic p-4 text-center">
      <p>ERRO AO CARREGAR RANKINGS</p>
      <p className="text-sm mt-2 font-sans not-italic">{error}</p>
      <button onClick={fetchRankings} className="mt-4 bg-primary text-background px-6 py-2 rounded-xl text-sm not-italic font-black">TENTAR NOVAMENTE</button>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">
      CARREGANDO RANKINGS...
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" /> RANKING
        </h1>
        <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
          <Calendar className="w-3 h-3" /> {monthName}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 gap-1">
        {([
          { key: 'xp_mes', label: 'XP DO MÊS' },
          { key: 'freq', label: 'FREQUÊNCIA' },
          { key: 'xp_total', label: 'XP TOTAL' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 py-3 rounded-xl font-headline font-bold text-[9px] uppercase tracking-widest transition-all",
              activeTab === key ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >{label}</button>
        ))}
      </div>

      {/* Subtítulo */}
      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest -mt-3">
        {activeTab === 'xp_mes' && `XP ganho em ${monthName} — reinicia todo mês`}
        {activeTab === 'freq' && `Check-ins realizados em ${monthName}`}
        {activeTab === 'xp_total' && 'XP acumulado desde o início — nunca zera'}
      </p>

      {/* Pódio */}
      <div className="flex items-end justify-center gap-4 pt-12 pb-4">
        {/* 2º */}
        {top3[1] && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-outline-variant/30 bg-surface-container-highest flex items-center justify-center">
                <span className="text-2xl font-headline font-black text-on-surface">{top3[1].name[0]}</span>
              </div>
              <div className="absolute -top-2 -right-2 bg-outline-variant/40 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#2</div>
            </div>
            <div className="text-center">
              <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{top3[1].name.split(' ')[0]}</p>
              <p className="text-[10px] text-on-surface-variant font-bold">{getScore(top3[1])}</p>
            </div>
            <div className="w-16 h-20 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
              <span className="text-[10px] font-headline font-black text-on-surface-variant italic">LVL {top3[1].level}</span>
            </div>
          </div>
        )}

        {/* 1º */}
        {top3[0] && (
          <div className="flex flex-col items-center gap-3 -mt-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-primary bg-surface-container-highest shadow-[0_0_30px_rgba(202,253,0,0.3)] flex items-center justify-center">
                <span className="text-4xl font-headline font-black text-primary">{top3[0].name[0]}</span>
              </div>
              <div className="absolute -top-3 -right-3 bg-primary text-background text-xs font-black px-3 py-1 rounded-full shadow-lg">#1</div>
            </div>
            <div className="text-center">
              <p className="text-sm font-headline font-black text-primary uppercase italic truncate max-w-[100px]">{top3[0].name.split(' ')[0]}</p>
              <p className="text-xs text-on-surface font-bold">{getScore(top3[0])}</p>
            </div>
            <div className="w-24 h-32 bg-primary/10 rounded-t-3xl border-x border-t border-primary/20 flex items-center justify-center">
              <span className="text-xs font-headline font-black text-primary italic">LVL {top3[0].level}</span>
            </div>
          </div>
        )}

        {/* 3º */}
        {top3[2] && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-secondary/30 bg-surface-container-highest flex items-center justify-center">
                <span className="text-2xl font-headline font-black text-on-surface">{top3[2].name[0]}</span>
              </div>
              <div className="absolute -top-2 -right-2 bg-secondary/30 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#3</div>
            </div>
            <div className="text-center">
              <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{top3[2].name.split(' ')[0]}</p>
              <p className="text-[10px] text-on-surface-variant font-bold">{getScore(top3[2])}</p>
            </div>
            <div className="w-16 h-16 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
              <span className="text-[10px] font-headline font-black text-on-surface-variant italic">LVL {top3[2].level}</span>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">TODOS ATLETAS</h3>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary text-xs font-bold flex items-center gap-1">
            {isExpanded ? 'RECOLHER' : 'EXPANDIR'} {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className={cn("space-y-3 transition-all duration-500 overflow-hidden", isExpanded ? "max-h-[2000px]" : "max-h-[300px]")}>
          {others.map((u, i) => (
            <motion.div key={u.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 4}</span>
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-sm border border-outline-variant/10">
                  {u.name[0]}
                </div>
                <div>
                  <p className="text-on-surface font-bold uppercase text-sm italic">{u.name}</p>
                  <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" /> Nível {u.level}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-on-surface font-headline font-black text-sm italic">{getScore(u)}</p>
                {activeTab === 'xp_mes' && (
                  <p className="text-on-surface-variant text-[9px] font-bold">Total: {u.xp} XP</p>
                )}
              </div>
            </motion.div>
          ))}
          {others.length === 0 && currentRank.length <= 3 && (
            <p className="text-center text-on-surface-variant text-xs font-bold uppercase tracking-widest py-4">
              Apenas {currentRank.length} atleta{currentRank.length !== 1 ? 's' : ''} no ranking
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
