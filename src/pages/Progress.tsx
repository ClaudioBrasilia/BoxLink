import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  History, TrendingUp, Trophy, Calendar, ChevronRight, 
  Activity, Target, Award, ArrowUpRight, ArrowDownRight,
  Filter, Search
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface WodResult {
  id: string;
  wod_id: string;
  result: string;
  type: 'RX' | 'Scaled' | 'Beginner';
  created_at: string;
  wods: {
    name: string;
    date: string;
    type: string;
  };
}

interface RewardHistory {
  id: string;
  type: string;
  xp: number;
  coins: number;
  description: string;
  created_at: string;
}

interface PR {
  id: string;
  exercise: string;
  value: string;
  date: string;
}

export default function Progress() {
  const { user } = useAuth();
  const [wodHistory, setWodHistory] = useState<WodResult[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RewardHistory[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wods' | 'challenges' | 'stats'>('wods');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [wodRes, rewardRes, prRes] = await Promise.all([
          supabase
            .from('wod_results')
            .select('*, wods(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('reward_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('personal_records')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
        ]);

        if (wodRes.data) setWodHistory(wodRes.data);
        if (rewardRes.data) setRewardHistory(rewardRes.data);
        if (prRes.data) setPrs(prRes.data);
      } catch (error) {
        console.error('Error fetching progress data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const challengeHistory = rewardHistory.filter(h => h.type === 'challenge');
  
  // Prepare data for XP chart
  const xpData = rewardHistory
    .slice()
    .reverse()
    .reduce((acc: any[], curr) => {
      const date = format(new Date(curr.created_at), 'dd/MM');
      const lastXp = acc.length > 0 ? acc[acc.length - 1].totalXp : 0;
      acc.push({
        date,
        xp: curr.xp,
        totalXp: lastXp + curr.xp
      });
      return acc;
    }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-12 h-12 text-primary animate-bounce" />
          <p className="font-headline font-black text-primary italic animate-pulse uppercase tracking-widest">Analisando Evolução...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 pb-32">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/20 rounded-2xl">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic leading-none">Minha Evolução</h1>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Acompanhe seu progresso histórico</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10">
        {(['wods', 'challenges', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab 
                ? "bg-primary text-background shadow-lg shadow-primary/20" 
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab === 'wods' ? 'WODs' : tab === 'challenges' ? 'Desafios' : 'Estatísticas'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'wods' && (
          <motion.div
            key="wods"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {wodHistory.length === 0 ? (
              <div className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 flex flex-col items-center text-center gap-4">
                <History className="w-12 h-12 text-on-surface-variant/20" />
                <p className="text-on-surface-variant font-medium italic">Nenhum resultado de WOD registrado ainda.</p>
              </div>
            ) : (
              wodHistory.map((result) => (
                <div 
                  key={result.id}
                  className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex items-center gap-4 group hover:border-primary/50 transition-all"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-headline font-black italic",
                    result.type === 'RX' ? "bg-primary/20 text-primary" :
                    result.type === 'Scaled' ? "bg-secondary-container text-on-secondary-container" :
                    "bg-surface-container-highest text-on-surface-variant"
                  )}>
                    {result.type?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold text-on-surface truncate uppercase italic">{result.wods?.name ?? 'WOD'}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                      <Calendar className="w-3 h-3" />
                      {result.wods?.date ? format(new Date(result.wods.date), 'dd MMM yyyy', { locale: ptBR }) : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-headline font-black text-primary italic text-lg">{result.result}</div>
                    <div className="text-[8px] font-black text-on-surface-variant uppercase tracking-tighter">{result.type ?? '—'}</div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'challenges' && (
          <motion.div
            key="challenges"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {challengeHistory.length === 0 ? (
              <div className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 flex flex-col items-center text-center gap-4">
                <Award className="w-12 h-12 text-on-surface-variant/20" />
                <p className="text-on-surface-variant font-medium italic">Nenhum desafio concluído ainda.</p>
              </div>
            ) : (
              challengeHistory.map((history) => (
                <div 
                  key={history.id}
                  className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline font-bold text-on-surface uppercase italic text-sm">{history.description}</h3>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                      {format(new Date(history.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-primary font-black text-xs">+{history.xp} XP</div>
                    <div className="text-secondary font-black text-[10px]">+{history.coins} BC</div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* XP Growth Chart */}
            <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">CRESCIMENTO DE XP</h3>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={xpData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#666" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1C1C1C', 
                        border: '1px solid #333',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: '#cafd00' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalXp" 
                      stroke="#cafd00" 
                      strokeWidth={3} 
                      dot={{ fill: '#cafd00', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PRs Section */}
            <div className="space-y-4">
              <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic px-2">RECORDES PESSOAIS (PRs)</h3>
              <div className="grid grid-cols-2 gap-4">
                {prs.map((pr) => (
                  <div key={pr.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-2">
                    <div className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest truncate">{pr.exercise}</div>
                    <div className="flex items-end justify-between">
                      <div className="font-headline font-black text-xl text-primary italic leading-none">{pr.value}</div>
                      <div className="text-[8px] text-on-surface-variant font-bold">{format(new Date(pr.date), 'dd/MM/yy')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
