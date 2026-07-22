import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Lock, TrendingUp, Activity, Dumbbell, Gauge, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isPremium } from '../lib/plan';
import { TrainingLog, TrainingFeeling } from '../types';

const FEELINGS: { value: TrainingFeeling; label: string; emoji: string }[] = [
  { value: 'otimo',   label: 'Ótimo',   emoji: '🔥' },
  { value: 'bem',     label: 'Bem',     emoji: '🙂' },
  { value: 'normal',  label: 'Normal',  emoji: '😐' },
  { value: 'cansado', label: 'Cansado', emoji: '🥱' },
  { value: 'dor',     label: 'Dor',     emoji: '🤕' },
];

const parseLoad = (v?: number | null) => (typeof v === 'number' && v > 0 ? v : 0);

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

    return { total: trainingLogs, avgRpe, feelingCount, rpeByFeeling, loadEvolution, perWeek };
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
            {['RPE médio por sensação', 'Evolução de carga (PRs)', 'Frequência semanal'].map(t => (
              <div key={t} className="bg-surface-container-highest/40 rounded-2xl px-4 py-3 flex items-center gap-2 blur-[1px]">
                <Lock className="w-3.5 h-3.5 text-on-surface-variant" />
                <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{t}</span>
              </div>
            ))}
          </div>
          <div className="bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full">
            🔒 Disponível no plano Premium
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO...</div>
  );

  const hasData = stats.total > 0;
  const maxFeeling = Math.max(1, ...Object.values(stats.feelingCount));

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
            <Tile icon={Activity} value={String(stats.total)} label="Treinos" />
            <Tile icon={Gauge} value={stats.avgRpe ? stats.avgRpe.toFixed(1) : '—'} label="RPE médio" />
            <Tile icon={TrendingUp} value={stats.perWeek ? stats.perWeek.toFixed(1) : '—'} label="Por semana" />
          </div>

          {/* Distribuição de sensação */}
          <Card title="Como você se sente" icon={Activity}>
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
            <Card title="Esforço x sensação" icon={Gauge}>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-3 italic">
                RPE médio conforme como você chegou ao treino
              </p>
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

          {/* Evolução de carga */}
          {stats.loadEvolution.length > 0 && (
            <Card title="Evolução de carga" icon={Dumbbell}>
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

const Tile = ({ icon: Icon, value, label }: { icon: typeof Activity; value: string; label: string }) => (
  <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10 flex flex-col items-center gap-1">
    <Icon className="w-4 h-4 text-primary mb-1" />
    <p className="text-2xl font-headline font-black text-on-surface italic leading-none">{value}</p>
    <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">{label}</p>
  </div>
);

const Card = ({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) => (
  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-surface-container rounded-3xl p-5 border border-outline-variant/10 flex flex-col gap-3">
    <h2 className="font-headline font-black text-sm text-on-surface uppercase italic flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" /> {title}
    </h2>
    {children}
  </motion.section>
);
