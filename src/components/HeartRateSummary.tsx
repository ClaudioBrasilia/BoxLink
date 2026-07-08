// src/components/HeartRateSummary.tsx
// ============================================================================
// Resumo de treino exibido ao ENCERRAR a leitura de FC.
// Gráfico moderno de BPM × tempo (área com gradiente) + estatísticas e
// distribuição por zona de esforço. Engaja o aluno ao fechar a sessão.
// ============================================================================
import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Timer, Flame, RotateCcw, Percent, Gauge, UserPlus } from 'lucide-react';
import type { HrSample } from '../hooks/useHeartRateSession';
import {
  ageFromBirthDate, estimateCalories, maxHrPercent, hasCalorieData, type Biometrics,
} from '../lib/heartRate';
import { cn } from '../lib/utils';

interface Props {
  samples: HrSample[];
  deviceName?: string | null;
  bio?: Biometrics;
  onClose: () => void;
}

// Peso de cada zona para o índice de esforço (carga do treino).
const ZONE_WEIGHTS = [1, 2, 3, 4, 5];

// Zonas alinhadas a getHeartRateZone() — com hex para o gráfico e classe p/ barra.
const ZONES = [
  { min: 0,   label: 'Repouso',     hex: '#60a5fa', tw: 'bg-blue-400' },
  { min: 100, label: 'Aquecimento', hex: '#4ade80', tw: 'bg-green-400' },
  { min: 120, label: 'Aeróbico',    hex: '#facc15', tw: 'bg-yellow-400' },
  { min: 140, label: 'Anaeróbico',  hex: '#fb923c', tw: 'bg-orange-400' },
  { min: 160, label: 'Máximo',      hex: '#f87171', tw: 'bg-red-400' },
];

function zoneIndex(bpm: number): number {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) if (bpm >= ZONES[i].min) idx = i;
  return idx;
}

function fmtTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function StatTile({ icon, label, value, unit, color }: {
  icon: React.ReactNode; label: string; value: string | number; unit?: string; color: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5', color)}>
        {icon}
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-black italic tabular-nums text-white leading-none">{value}</span>
        {unit && <span className="text-[9px] font-black uppercase text-white/40 pb-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as HrSample;
  return (
    <div className="bg-black/90 border border-white/10 rounded-xl px-3 py-2">
      <p className="text-primary text-sm font-black italic tabular-nums">{p.bpm} <span className="text-[9px] text-white/40">BPM</span></p>
      <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">{fmtTime(p.t)}</p>
    </div>
  );
}

export default function HeartRateSummary({ samples, deviceName, bio = {}, onClose }: Props) {
  const stats = useMemo(() => {
    const bpms = samples.map((s) => s.bpm);
    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    const max = Math.max(...bpms);
    const min = Math.min(...bpms);
    const durationSec = samples[samples.length - 1]?.t ?? 0;

    // Tempo por zona (cada amostra ≈ intervalo entre amostras)
    const stepSec = samples.length > 1 ? Math.max(1, Math.round(durationSec / (samples.length - 1))) : 2;
    const zoneSecs = new Array(ZONES.length).fill(0);
    for (const s of samples) zoneSecs[zoneIndex(s.bpm)] += stepSec;
    const totalZoneSec = zoneSecs.reduce((a, b) => a + b, 0) || 1;
    const dominant = zoneSecs.indexOf(Math.max(...zoneSecs));

    // Índice de esforço (carga): minutos em cada zona × peso da zona.
    const effort = Math.round(
      zoneSecs.reduce((acc, sec, i) => acc + (sec / 60) * ZONE_WEIGHTS[i], 0)
    );

    // Métricas dependentes da biometria
    const age = ageFromBirthDate(bio.birthDate);
    const calories = hasCalorieData(bio) ? estimateCalories(avg, durationSec / 60, bio) : null;
    const avgPctMax = maxHrPercent(avg, age);

    return { avg, max, min, durationSec, zoneSecs, totalZoneSec, dominant, effort, calories, avgPctMax };
  }, [samples, bio]);

  const showCalories = stats.calories != null;
  const showPct = stats.avgPctMax != null;

  const yDomain: [number, number] = [Math.max(30, stats.min - 8), stats.max + 8];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/15">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-white text-xs font-black uppercase italic tracking-widest">Treino Concluído</p>
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">
              {deviceName || 'Sessão de FC'} · {fmtTime(stats.durationSec)}
            </p>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-1">
          <Flame className="w-3 h-3 text-primary" />
          <span className="text-primary text-[9px] font-black uppercase tabular-nums">{ZONES[stats.dominant].label}</span>
        </div>
      </div>

      {/* Gráfico BPM × tempo */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3 pt-4">
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={samples} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cafd00" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#cafd00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t" type="number" domain={[0, 'dataMax']}
                tickFormatter={fmtTime} minTickGap={40}
                stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 9, fontWeight: 900 }} tickLine={false} axisLine={false}
              />
              <YAxis
                domain={yDomain} width={34}
                stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 9, fontWeight: 900 }} tickLine={false} axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <ReferenceLine y={stats.avg} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4"
                label={{ value: `média ${stats.avg}`, position: 'insideTopRight', fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900 }} />
              <Area type="monotone" dataKey="bpm" stroke="#cafd00" strokeWidth={2.5}
                fill="url(#hrFill)" dot={false} activeDot={{ r: 4, fill: '#cafd00' }} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={<Activity className="w-3 h-3" />} label="FC Média"  value={stats.avg} unit="bpm" color="text-primary" />
        <StatTile icon={<Timer className="w-3 h-3" />}    label="Duração"   value={fmtTime(stats.durationSec)} color="text-white/60" />
        <StatTile icon={<TrendingUp className="w-3 h-3" />}   label="FC Máxima" value={stats.max} unit="bpm" color="text-red-400" />
        <StatTile icon={<TrendingDown className="w-3 h-3" />} label="FC Mínima" value={stats.min} unit="bpm" color="text-blue-400" />
      </div>

      {/* Métricas avançadas */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile icon={<Gauge className="w-3 h-3" />} label="Esforço" value={stats.effort} color="text-primary" />
        {showCalories
          ? <StatTile icon={<Flame className="w-3 h-3" />} label="Calorias" value={stats.calories!} unit="kcal" color="text-orange-400" />
          : <StatTile icon={<Flame className="w-3 h-3" />} label="Calorias" value="—" color="text-white/30" />}
        {showPct
          ? <StatTile icon={<Percent className="w-3 h-3" />} label="Da FC Máx" value={stats.avgPctMax!} unit="%" color="text-yellow-400" />
          : <StatTile icon={<Percent className="w-3 h-3" />} label="Da FC Máx" value="—" color="text-white/30" />}
      </div>

      {/* CTA: completar perfil para liberar calorias / %FCmáx */}
      {(!showCalories || !showPct) && (
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-xl p-3">
          <UserPlus className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-white/60 text-[10px] font-black uppercase leading-relaxed">
            Complete seu perfil (peso, nascimento e sexo) para ver calorias e % da FC máxima.
          </p>
        </div>
      )}

      {/* Distribuição por zona */}
      <div className="flex flex-col gap-2">
        <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Tempo por Zona</p>
        <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-white/5">
          {ZONES.map((z, i) =>
            stats.zoneSecs[i] > 0 ? (
              <div key={z.label} className={z.tw} style={{ width: `${(stats.zoneSecs[i] / stats.totalZoneSec) * 100}%` }} />
            ) : null
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-0.5">
          {ZONES.map((z, i) =>
            stats.zoneSecs[i] > 0 ? (
              <div key={z.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-2 h-2 rounded-full', z.tw)} />
                  <span className="text-white/50 text-[9px] font-black uppercase tracking-wider">{z.label}</span>
                </div>
                <span className="text-white/30 text-[9px] font-black tabular-nums">{fmtTime(stats.zoneSecs[i])}</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      <button onClick={onClose}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(202,253,0,0.2)]">
        <RotateCcw className="w-4 h-4" /> Novo Treino
      </button>
    </motion.div>
  );
}
