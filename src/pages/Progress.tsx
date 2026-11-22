import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  TrendingUp, Zap, Flame, Medal, CalendarCheck, Activity,
  ArrowRight, BookOpen, Trophy, Target, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import {
  PERIODS,
  type EvolutionPeriod,
  type RewardRow,
  buildXpSeries,
  buildWeeklyConsistency,
  summarizeEvolution,
  periodLabel,
  dateKey,
  shiftDays,
} from '../lib/evolution';

// "Minha Evolução" deixou de ser um arquivo de resultados.
//
// Antes havia três abas: WODs (lista que já vive no Diário e no Perfil),
// Desafios (consulta idêntica à página Desafios) e Estatísticas. As duas
// primeiras repetiam outras telas e saíram; o que ficou responde à pergunta que
// dá nome à página: "estou evoluindo?".

interface PR {
  id: string;
  exercise: string;
  value: string;
  date: string;
}

interface EvolutionData {
  rewards: RewardRow[];
  checkinDates: string[];
  trainingDates: string[];
  prs: PR[];
}

const EMPTY_DATA: EvolutionData = { rewards: [], checkinDates: [], trainingDates: [], prs: [] };

const CHART_TOOLTIP = {
  backgroundColor: '#1C1C1C',
  border: '1px solid #333',
  borderRadius: '12px',
  fontSize: '12px',
};

// Data inválida em `personal_records` não pode derrubar a tela (format lança
// RangeError com Invalid Date).
function formatPrDate(value: string): string {
  const key = dateKey(value);
  if (!key) return '—';
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'dd/MM/yy', { locale: ptBR });
}

export default function Progress() {
  const { user } = useAuth();
  const [data, setData] = useState<EvolutionData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<EvolutionPeriod>(90);

  const isIndividual = user?.accountType === 'individual';

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchData = async () => {
      try {
        // Uma consulta por fonte: todas as agregações acontecem em memória,
        // porque o volume por atleta é pequeno e assim a tela troca de período
        // sem bater no banco de novo.
        const [rewardRes, checkinRes, trainingRes, prRes] = await Promise.all([
          supabase
            .from('reward_history')
            .select('xp, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('checkins')
            .select('date')
            .eq('user_id', user.id),
          supabase
            .from('training_logs')
            .select('date')
            .eq('user_id', user.id),
          supabase
            .from('personal_records')
            .select('id, exercise, value, date')
            .eq('user_id', user.id)
            .order('date', { ascending: false }),
        ]);

        if (cancelled) return;
        setData({
          rewards: (rewardRes.data as RewardRow[]) || [],
          checkinDates: ((checkinRes.data as { date: string }[]) || []).map((c) => c.date),
          trainingDates: ((trainingRes.data as { date: string }[]) || []).map((t) => t.date),
          prs: (prRes.data as PR[]) || [],
        });
      } catch (error) {
        console.error('Erro ao carregar evolução:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user?.id]);

  // No box o treino é o check-in; no individual é o registro do diário.
  const workoutDates = isIndividual ? data.trainingDates : data.checkinDates;
  const workoutNoun = isIndividual ? 'treinos' : 'check-ins';

  const summary = useMemo(
    () => summarizeEvolution({
      rewards: data.rewards,
      workoutDates,
      prDates: data.prs.map((pr) => pr.date),
      days: period,
    }),
    [data.rewards, workoutDates, data.prs, period],
  );

  const xpSeries = useMemo(() => buildXpSeries(data.rewards, period, new Date()), [data.rewards, period]);

  // Oito semanas é o suficiente para ver ritmo sem virar uma parede de barras.
  const weekly = useMemo(() => buildWeeklyConsistency(workoutDates, 8, new Date()), [workoutDates]);
  const bestWeek = weekly.reduce((max, week) => Math.max(max, week.count), 0);

  const periodStart = shiftDays(dateKey(new Date()), -(period - 1));
  const recentPrs = useMemo(
    () => data.prs.filter((pr) => dateKey(pr.date) >= periodStart).slice(0, 4),
    [data.prs, periodStart],
  );
  const olderPrs = useMemo(
    () => (recentPrs.length === 0 ? data.prs.slice(0, 4) : []),
    [data.prs, recentPrs.length],
  );

  const hasAnyData = data.rewards.length > 0 || workoutDates.length > 0 || data.prs.length > 0;
  const xpTickInterval = Math.max(0, Math.ceil(xpSeries.length / 6) - 1);

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
    <div className="p-6 space-y-6 pb-32">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/20 rounded-2xl">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic leading-none">Minha Evolução</h1>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Seu progresso em números</p>
          </div>
        </div>
      </header>

      {/* Período */}
      <div className="flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10">
        {PERIODS.map((option) => (
          <button
            key={option}
            onClick={() => setPeriod(option)}
            className={cn(
              'flex-1 py-2.5 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all',
              period === option
                ? 'bg-primary text-background shadow-lg shadow-primary/20'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {periodLabel(option)}
          </button>
        ))}
      </div>

      {!hasAnyData ? (
        <div className="bg-surface-container-low p-10 rounded-3xl border border-outline-variant/10 flex flex-col items-center text-center gap-3">
          <Target className="w-12 h-12 text-on-surface-variant/20" />
          <p className="font-headline font-black text-on-surface uppercase italic">Ainda sem dados</p>
          <p className="text-[11px] text-on-surface-variant font-bold">
            {isIndividual
              ? 'Registre seu primeiro treino no Diário para ver a evolução aqui.'
              : 'Faça seu primeiro check-in para ver a evolução aqui.'}
          </p>
        </div>
      ) : (
        <>
          {/* Números do período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-1 mb-1">
                <Zap className="w-3 h-3 text-primary" /> XP no período
              </p>
              <p className="font-headline font-black text-primary text-2xl italic leading-none">{summary.totalXp}</p>
              <p className="text-[9px] text-on-surface-variant font-bold mt-1">+{summary.xpPerWeek} XP por semana</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-1 mb-1">
                <CalendarCheck className="w-3 h-3 text-primary" /> {isIndividual ? 'Treinos' : 'Check-ins'}
              </p>
              <p className="font-headline font-black text-on-surface text-2xl italic leading-none">{summary.workouts}</p>
              <p className="text-[9px] text-on-surface-variant font-bold mt-1">{summary.workoutsPerWeek} por semana</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-1 mb-1">
                <Medal className="w-3 h-3 text-secondary" /> Recordes
              </p>
              <p className="font-headline font-black text-secondary text-2xl italic leading-none">{summary.prs}</p>
              <p className="text-[9px] text-on-surface-variant font-bold mt-1">PRs no período</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10">
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest flex items-center gap-1 mb-1">
                <Flame className="w-3 h-3 text-secondary" /> Sequência
              </p>
              <p className="font-headline font-black text-on-surface text-2xl italic leading-none">{summary.streak}</p>
              <p className="text-[9px] text-on-surface-variant font-bold mt-1">
                {summary.streak === 1 ? 'semana seguida' : 'semanas seguidas'}
              </p>
            </div>
          </div>

          {/* XP acumulado */}
          <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">XP acumulado</h3>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
                  Últimos {periodLabel(period)}
                </p>
              </div>
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={xpSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#666"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={xpTickInterval}
                  />
                  <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} width={34} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    itemStyle={{ color: '#cafd00' }}
                    formatter={(value: number) => [`${value} XP`, 'Acumulado']}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalXp"
                    stroke="#cafd00"
                    strokeWidth={3}
                    dot={xpSeries.length <= 31 ? { fill: '#cafd00', strokeWidth: 2, r: 3 } : false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Constância */}
          <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">Constância</h3>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
                  {workoutNoun} por semana · melhor semana: {bestWeek}
                </p>
              </div>
              <CalendarCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="label" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    cursor={{ fill: 'rgba(202,253,0,0.06)' }}
                    formatter={(value: number) => [value, isIndividual ? 'Treinos' : 'Check-ins']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {weekly.map((week) => (
                      <Cell
                        key={week.key}
                        fill={week.count > 0 && week.count === bestWeek ? '#cafd00' : '#3a3a3a'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold flex items-start gap-1.5">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {summary.activeWeeks} de {summary.weeksInPeriod} semanas com {workoutNoun} no período.
            </p>
          </div>

          {/* Recordes */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-headline font-bold text-sm text-on-surface uppercase italic">Recordes recentes</h3>
              <Link to="/profile" className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentPrs.length === 0 && olderPrs.length === 0 ? (
              <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 flex flex-col items-center text-center gap-2">
                <Medal className="w-10 h-10 text-on-surface-variant/20" />
                <p className="text-[11px] text-on-surface-variant font-bold">Nenhum recorde registrado ainda.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(recentPrs.length > 0 ? recentPrs : olderPrs).map((pr) => (
                    <div key={pr.id} className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-2">
                      <div className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest truncate">{pr.exercise}</div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="font-headline font-black text-xl text-primary italic leading-none truncate">{pr.value}</div>
                        <div className="text-[8px] text-on-surface-variant font-bold flex-shrink-0">
                          {formatPrDate(pr.date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {recentPrs.length === 0 && (
                  <p className="text-[9px] text-on-surface-variant font-bold px-1">
                    Nenhum recorde nos últimos {periodLabel(period)} — mostrando os mais antigos.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Atalhos: o histórico completo vive nas outras telas */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/diario"
          className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex items-center gap-3 hover:border-primary/40 transition-all"
        >
          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-headline font-black text-on-surface uppercase italic">Diário</p>
            <p className="text-[9px] text-on-surface-variant font-bold">histórico de treinos</p>
          </div>
        </Link>
        <Link
          to={isIndividual ? '/benchmarks' : '/challenges'}
          className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 flex items-center gap-3 hover:border-primary/40 transition-all"
        >
          {isIndividual
            ? <Target className="w-4 h-4 text-secondary flex-shrink-0" />
            : <Trophy className="w-4 h-4 text-secondary flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-[11px] font-headline font-black text-on-surface uppercase italic">
              {isIndividual ? 'Benchmarks' : 'Desafios'}
            </p>
            <p className="text-[9px] text-on-surface-variant font-bold">
              {isIndividual ? 'comparar marcas' : 'o que você concluiu'}
            </p>
          </div>
        </Link>
      </div>

    </div>
  );
}
