import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Lock, TrendingUp, Activity, Dumbbell, Gauge, Crown, Moon, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isPremium } from '../lib/plan';
import { TrainingLog, TrainingFeeling } from '../types';
import PremiumCTA from '../components/PremiumCTA';

const FEELINGS: { value: TrainingFeeling; label: string; emoji: string }[] = [
  { value: 'otimo',   label: 'Ótimo',   emoji: '🔥' },
  { value: 'bem',     label: 'Bem',     emoji: '🙂' },
  { value: 'normal',  label: 'Normal',  emoji: '😐' },
  { value: 'cansado', label: 'Cansado', emoji: '🥱' },
  { value: 'dor',     label: 'Dor',     emoji: '🤕' },
];

const parseLoad = (v?: number | null) => (typeof v === 'number' && v > 0 ? v : 0);

const HEATMAP_WEEKS = 18;
const DAY_MS = 86400000;
const dateKey = (d: Date) => d.toLocaleDateString('en-CA');

const SLEEP_BUCKETS: { key: string; label: string; test: (h: number) => boolean }[] = [
  { key: '<6h',  label: '< 6h',  test: h => h < 6 },
  { key: '6-7h', label: '6–7h',  test: h => h >= 6 && h < 7 },
  { key: '7-8h', label: '7–8h',  test: h => h >= 7 && h < 8 },
  { key: '8h+',  label: '8h+',   test: h => h >= 8 },
];

export default function Insights() {
  const { user } = useAuth();
  const premium = isPremium(user);

  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !premium) { setLoading(false); return; }
    supabase
      .from('training_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(500)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [user, premium]);

  const stats = useMemo(() => {
    const withRpe = logs.filter(l => typeof l.rpe === 'number' && l.rpe! > 0);
    const avgRpe = withRpe.length
      ? withRpe.reduce((s, l) => s + (l.rpe || 0), 0) / withRpe.length
      : 0;

    // Distribuição de sensação
    const feelingCount: Record<string, number> = {};
    logs.forEach(l => { if (l.feeling) feelingCount[l.feeling] = (feelingCount[l.feeling] || 0) + 1; });

    // RPE médio por sensação
    const rpeByFeeling: Record<string, { sum: number; n: number }> = {};
    withRpe.forEach(l => {
      if (!l.feeling) return;
      (rpeByFeeling[l.feeling] ||= { sum: 0, n: 0 });
      rpeByFeeling[l.feeling].sum += l.rpe || 0;
      rpeByFeeling[l.feeling].n += 1;
    });

    // RPE médio por faixa de horas de sono — sono x desempenho
    const rpeBySleep: Record<string, { sum: number; n: number }> = {};
    logs.forEach(l => {
      if (typeof l.sleep_hours !== 'number' || l.sleep_hours <= 0) return;
      if (typeof l.rpe !== 'number' || l.rpe <= 0) return;
      const bucket = SLEEP_BUCKETS.find(b => b.test(l.sleep_hours!));
      if (!bucket) return;
      (rpeBySleep[bucket.key] ||= { sum: 0, n: 0 });
      rpeBySleep[bucket.key].sum += l.rpe;
      rpeBySleep[bucket.key].n += 1;
    });

    // Streak (dias seguidos) e heatmap de consistência
    const activityDates = Array.from(new Set(logs.map(l => l.date))).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    if (activityDates.length) {
      const todayStr = dateKey(new Date());
      const yesterdayStr = dateKey(new Date(Date.now() - DAY_MS));
      const desc = [...activityDates].reverse();
      if (desc[0] === todayStr || desc[0] === yesterdayStr) {
        currentStreak = 1;
        for (let i = 1; i < desc.length; i++) {
          const prev = new Date(desc[i - 1] + 'T00:00:00').getTime();
          const curr = new Date(desc[i] + 'T00:00:00').getTime();
          if (prev - curr === DAY_MS) currentStreak++; else break;
        }
      }
      let run = 1;
      longestStreak = 1;
      for (let i = 1; i < activityDates.length; i++) {
        const prev = new Date(activityDates[i - 1] + 'T00:00:00').getTime();
        const curr = new Date(activityDates[i] + 'T00:00:00').getTime();
        if (curr - prev === DAY_MS) { run++; longestStreak = Math.max(longestStreak, run); }
        else run = 1;
      }
    }

    const countByDate: Record<string, number> = {};
    logs.forEach(l => { countByDate[l.date] = (countByDate[l.date] || 0) + 1; });
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay())); // sábado da semana atual
    const totalDays = HEATMAP_WEEKS * 7;
    const start = new Date(endOfWeek);
    start.setDate(start.getDate() - totalDays + 1); // domingo, início da 1ª semana
    const heatmapCols: { date: string; count: number }[][] = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const col: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(day.getDate() + w * 7 + d);
        const key = dateKey(day);
        col.push({ date: key, count: countByDate[key] || 0 });
      }
      heatmapCols.push(col);
    }

    // Evolução de carga por exercício
    const byExercise: Record<string, { first: number; last: number; firstDate: string; lastDate: string; name: string }> = {};
    logs.filter(l => l.category === 'forca' && l.exercise && parseLoad(l.load_kg))
      .forEach(l => {
        const key = l.exercise!.trim().toLowerCase();
        const load = parseLoad(l.load_kg);
        if (!byExercise[key]) {
          byExercise[key] = { first: load, last: load, firstDate: l.date, lastDate: l.date, name: l.exercise!.trim() };
        } else {
          byExercise[key].last = load;
          byExercise[key].lastDate = l.date;
        }
      });
    const loadEvolution = Object.values(byExercise)
      .map(e => ({ ...e, delta: e.last - e.first }))
      .sort((a, b) => b.delta - a.delta);

    // Treinos por semana (média nas semanas ativas)
    const weeks = new Set(logs.filter(l => l.category !== 'nota').map(l => {
      const d = new Date(l.date + 'T00:00:00');
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-${week}`;
    }));
    const trainingLogs = logs.filter(l => l.category !== 'nota').length;
    const perWeek = weeks.size ? trainingLogs / weeks.size : 0;

    return {
      total: trainingLogs, avgRpe, feelingCount, rpeByFeeling, rpeBySleep, loadEvolution, perWeek,
      currentStreak, longestStreak, heatmapCols,
    };
  }, [logs]);

  // ── Bloqueio premium ────────────────────────────────────────────────────────
  if (!premium) {
    return (
      <div className="min-h-screen bg-background p-4 pt-8 pb-32">
        <Header />
        <div className="mt-6 bg-surface-container-low rounded-[2rem] border border-secondary/20 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-secondary/10 flex items-center justify-center">
            <Crown className="w-8 h-8 text-secondary" />
          </div>
          <h2 className="font-headline font-black text-xl text-on-surface uppercase italic">Insights é Premium</h2>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed max-w-xs">
            Descubra como sono, dor e cansaço afetam seu desempenho, e acompanhe a
            evolução de carga por exercício.
          </p>
          <div className="w-full flex flex-col gap-2 mt-2 opacity-60">
            {['RPE médio por sensação', 'Sono x desempenho', 'Evolução de carga (PRs)', 'Consistência (heatmap)'].map(t => (
              <div key={t} className="bg-surface-container-highest/40 rounded-2xl px-4 py-3 flex items-center gap-2 blur-[1px]">
                <Lock className="w-3.5 h-3.5 text-on-surface-variant" />
                <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{t}</span>
              </div>
            ))}
          </div>
          <div className="bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full">
            🔒 Disponível no plano Premium
          </div>
          <PremiumCTA />
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO...</div>
  );

  const hasData = stats.total > 0;
  const maxFeeling = Math.max(1, ...Object.values(stats.feelingCount));
  const todayStr = dateKey(new Date());

  return (
    <div className="min-h-screen bg-background p-4 pt-8 pb-32 flex flex-col gap-6">
      <Header />

      {!hasData ? (
        <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-12 flex flex-col items-center text-center gap-4">
          <Activity className="w-14 h-14 text-on-surface-variant/20" />
          <p className="text-on-surface-variant font-headline font-black uppercase italic">Sem dados ainda</p>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
            Registre treinos com RPE e sensação no Diário
          </p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            <Tile icon={Activity} value={String(stats.total)} label="Treinos" hint="Total registrado" />
            <Tile icon={Gauge} value={stats.avgRpe ? stats.avgRpe.toFixed(1) : '—'} label="RPE médio" hint="Esforço percebido (0–10)" />
            <Tile icon={TrendingUp} value={stats.perWeek ? stats.perWeek.toFixed(1) : '—'} label="Por semana" hint="Média nas semanas ativas" />
          </div>

          {/* Streak e heatmap de consistência */}
          <Card title="Consistência" icon={Flame} subtitle="Seus treinos nas últimas semanas">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">🔥</span>
                <span className="text-lg font-headline font-black text-on-surface italic leading-none">{stats.currentStreak}</span>
                <span className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">seguidos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-headline font-black text-secondary italic leading-none">{stats.longestStreak}</span>
                <span className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">recorde</span>
              </div>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-[3px] w-max">
                {stats.heatmapCols.map((col, i) => (
                  <div key={i} className="flex flex-col gap-[3px]">
                    {col.map(day => {
                      const isFuture = day.date > todayStr;
                      return (
                        <div
                          key={day.date}
                          title={isFuture ? undefined : `${day.date}${day.count ? ` • ${day.count} registro(s)` : ' • sem treino'}`}
                          className={cn(
                            'w-2.5 h-2.5 rounded-[3px]',
                            isFuture
                              ? 'opacity-0'
                              : day.count >= 2 ? 'bg-primary' : day.count === 1 ? 'bg-primary/40' : 'bg-surface-container-highest/40'
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Distribuição de sensação */}
          <Card title="Como você se sente" icon={Activity} subtitle="Quantas vezes você registrou cada sensação após o treino">
            <div className="flex flex-col gap-2">
              {FEELINGS.filter(f => stats.feelingCount[f.value]).map(f => {
                const n = stats.feelingCount[f.value] || 0;
                return (
                  <div key={f.value} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{f.emoji}</span>
                    <div className="flex-1 h-6 bg-surface-container-highest/40 rounded-lg overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-lg flex items-center justify-end px-2"
                        style={{ width: `${Math.max(12, (n / maxFeeling) * 100)}%` }}>
                        <span className="text-[10px] font-black text-background">{n}</span>
                      </div>
                    </div>
                    <span className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest w-14">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* RPE por sensação — insight cruzado */}
          {Object.keys(stats.rpeByFeeling).length > 0 && (
            <Card title="Esforço x sensação" icon={Gauge} subtitle="RPE médio conforme como você chegou ao treino">
              <div className="flex flex-col gap-2">
                {FEELINGS.filter(f => stats.rpeByFeeling[f.value]).map(f => {
                  const r = stats.rpeByFeeling[f.value];
                  const avg = r.sum / r.n;
                  return (
                    <div key={f.value} className="flex items-center justify-between bg-surface-container-highest/30 rounded-xl px-4 py-2.5">
                      <span className="text-[11px] font-bold text-on-surface uppercase italic">{f.emoji} {f.label}</span>
                      <span className="text-sm font-headline font-black text-primary italic">RPE {avg.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Sono x desempenho */}
          {Object.keys(stats.rpeBySleep).length > 0 && (
            <Card title="Sono x desempenho" icon={Moon} subtitle="RPE médio conforme quantas horas você dormiu na noite anterior">
              <div className="flex flex-col gap-2">
                {SLEEP_BUCKETS.filter(b => stats.rpeBySleep[b.key]).map(b => {
                  const r = stats.rpeBySleep[b.key];
                  const avg = r.sum / r.n;
                  return (
                    <div key={b.key} className="flex items-center justify-between bg-surface-container-highest/30 rounded-xl px-4 py-2.5">
                      <span className="text-[11px] font-bold text-on-surface uppercase italic">{b.label}</span>
                      <span className="text-sm font-headline font-black text-primary italic">RPE {avg.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Evolução de carga */}
          {stats.loadEvolution.length > 0 && (
            <Card title="Evolução de carga" icon={Dumbbell} subtitle="Comparação entre a primeira e a última carga registrada em cada exercício">
              <div className="flex flex-col gap-2">
                {stats.loadEvolution.slice(0, 6).map(e => (
                  <div key={e.name} className="flex items-center justify-between bg-surface-container-highest/30 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-[11px] font-bold text-on-surface uppercase italic">{e.name}</p>
                      <p className="text-[9px] text-on-surface-variant font-bold">{e.first}kg → {e.last}kg</p>
                    </div>
                    <span className={cn('text-sm font-headline font-black italic',
                      e.delta > 0 ? 'text-primary' : e.delta < 0 ? 'text-error' : 'text-on-surface-variant')}>
                      {e.delta > 0 ? '+' : ''}{e.delta}kg
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

const Header = () => (
  <header className="flex items-center gap-3">
    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
      <Sparkles className="w-6 h-6 text-primary" />
    </div>
    <div>
      <h1 className="text-3xl font-headline font-black italic text-on-surface uppercase tracking-tight leading-none">Insights</h1>
      <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60">Seus dados, suas respostas</p>
    </div>
  </header>
);

const Tile = ({ icon: Icon, value, label, hint }: { icon: typeof Activity; value: string; label: string; hint?: string }) => (
  <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex flex-col items-center gap-1">
    <Icon className="w-4 h-4 text-primary mb-1" />
    <p className="text-2xl font-headline font-black text-on-surface italic leading-none">{value}</p>
    <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">{label}</p>
    {hint && <p className="text-[7px] text-on-surface-variant/60 font-bold uppercase tracking-widest text-center leading-tight">{hint}</p>}
  </div>
);

const Card = ({ title, icon: Icon, subtitle, children }: { title: string; icon: typeof Activity; subtitle?: string; children: React.ReactNode }) => (
  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-surface-container rounded-3xl p-5 border border-outline-variant/10 flex flex-col gap-3">
    <div>
      <h2 className="font-headline font-black text-sm text-on-surface uppercase italic flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h2>
      {subtitle && (
        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest italic mt-1 opacity-70">
          {subtitle}
        </p>
      )}
    </div>
    {children}
  </motion.section>
);
