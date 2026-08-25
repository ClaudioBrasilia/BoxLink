import { Activity, BatteryWarning, Gauge, Info, ShieldCheck } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReadinessTrend, ReadinessTrendPoint } from '../lib/readinessTrend';
import { readinessLevelLabel } from '../lib/readinessTrend';
import { cn } from '../lib/utils';

interface Props {
  trend: ReadinessTrend;
}

const STATUS_COLORS = {
  ready: '#b8f500',
  control: '#fbbf24',
  recovery: '#fb7185',
};

const CHART_GRID = 'rgba(255,255,255,0.07)';
const AXIS = 'rgba(255,255,255,0.42)';

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}` : date;
}

function formatMetric(metric: number | null, suffix = ''): string {
  return metric == null ? 'Sem dado' : `${Math.round(metric)}${suffix}`;
}

function HrvTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ReadinessTrendPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-[#171b1d] px-3 py-2 shadow-xl">
      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{formatDate(point.date)}</p>
      <p className="mt-1 text-sm font-headline font-black italic text-cyan-300">{formatMetric(point.hrvMs, ' ms')}</p>
      <p className="text-[9px] font-bold text-on-surface-variant">{point.hrvMetric === 'sdnn' ? 'SDNN' : point.hrvMetric === 'rmssd' ? 'RMSSD' : 'HRV'}</p>
      {point.hrvBaselineMs != null && (
        <p className="mt-1 text-[9px] font-bold text-on-surface-variant">Baseline: {formatMetric(point.hrvBaselineMs, ' ms')}</p>
      )}
      {point.hrvDeltaPct != null && (
        <p className={cn('text-[9px] font-black', point.hrvDeltaPct < 0 ? 'text-amber-300' : 'text-primary')}>
          {point.hrvDeltaPct > 0 ? '+' : ''}{point.hrvDeltaPct.toFixed(0)}% vs. baseline
        </p>
      )}
    </div>
  );
}

function ReadinessTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ReadinessTrendPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-[#171b1d] px-3 py-2 shadow-xl">
      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{formatDate(point.date)}</p>
      <p className="mt-1 text-sm font-headline font-black italic" style={{ color: STATUS_COLORS[point.readinessStatus] }}>
        {point.readinessLabel}
      </p>
      <p className="text-[9px] font-bold text-on-surface-variant">
        {point.readinessHasHistory ? `Confiança ${point.readinessConfidence === 'high' ? 'alta' : point.readinessConfidence === 'medium' ? 'média' : 'inicial'}` : 'Histórico insuficiente'}
      </p>
      {point.rpe != null && <p className="mt-1 text-[9px] font-bold text-on-surface-variant">RPE: {point.rpe.toFixed(1)}</p>}
      {point.sleepHours != null && <p className="text-[9px] font-bold text-on-surface-variant">Sono: {point.sleepHours.toFixed(1)}h</p>}
    </div>
  );
}

function ReadinessTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  if (x == null || y == null || payload?.value == null) return null;
  return (
    <text x={x} y={y} textAnchor="end" fill={AXIS} fontSize={9} fontWeight={800}>
      {readinessLevelLabel(payload.value)}
    </text>
  );
}

function StatusDot(props: { cx?: number; cy?: number; payload?: ReadinessTrendPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.readinessLevel == null) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill={STATUS_COLORS[payload.readinessStatus]} stroke="#171b1d" strokeWidth={2} />;
}

function EmptyChart({ title, message, icon: Icon }: { title: string; message: string; icon: typeof Activity }) {
  return (
    <div className="min-h-[180px] rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-highest/20 flex flex-col items-center justify-center gap-2 px-6 text-center">
      <Icon className="h-7 w-7 text-on-surface-variant/30" />
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{title}</p>
      <p className="max-w-sm text-[10px] font-bold leading-relaxed text-on-surface-variant/60">{message}</p>
    </div>
  );
}

export default function ReadinessTrendCharts({ trend }: Props) {
  const hasHrv = trend.hrvPointCount > 0;
  const hasReadiness = trend.readinessPointCount > 0;
  const metricLabel = trend.latestHrvMetric === 'sdnn' ? 'SDNN' : trend.latestHrvMetric === 'rmssd' ? 'RMSSD' : 'HRV';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <Activity className="h-4 w-4 text-cyan-300" />
        <div>
          <h2 className="font-headline text-sm font-black uppercase italic text-on-surface">Tendências de recuperação</h2>
          <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">Últimos 28 dias · histórico individual</p>
        </div>
      </div>

      <section className="rounded-3xl border border-cyan-300/15 bg-surface-container p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-headline text-sm font-black uppercase italic text-on-surface">
              <Activity className="h-4 w-4 text-cyan-300" /> HRV / VFC
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {hasHrv ? `${metricLabel} em ms · linha pontilhada = baseline` : 'Variação entre batimentos em repouso'}
            </p>
          </div>
          {hasHrv && <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-200">{trend.hrvPointCount} medições</span>}
        </div>

        {hasHrv ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.points} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrvTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortDate" tick={{ fill: AXIS, fontSize: 9, fontWeight: 800 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fill: AXIS, fontSize: 9, fontWeight: 800 }} tickLine={false} axisLine={false} width={42} domain={['auto', 'auto']} unit=" ms" />
                <Tooltip content={<HrvTooltip />} cursor={{ stroke: 'rgba(103,232,249,0.35)' }} />
                <Area type="monotone" dataKey="hrvMs" stroke="#67e8f9" strokeWidth={2.5} fill="url(#hrvTrendFill)" connectNulls={false} dot={{ r: 2.5, fill: '#67e8f9', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#67e8f9', stroke: '#171b1d', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="hrvBaselineMs" stroke="#67e8f9" strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart icon={Info} title="Sem HRV sincronizada" message="Conecte um dispositivo que envie intervalos RR ou sincronize HRV pelo Apple Health/Health Connect. Sem RR, o aplicativo não inventa uma tendência." />
        )}

        {hasHrv && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-cyan-300" /> HRV</span>
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t border-dashed border-cyan-300/60" /> baseline individual</span>
            {trend.latestHrvMs != null && <span className="text-cyan-200">Atual: {Math.round(trend.latestHrvMs)} ms</span>}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-primary/15 bg-surface-container p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-headline text-sm font-black uppercase italic text-on-surface">
              <Gauge className="h-4 w-4 text-primary" /> Prontidão diária
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Pronto · controle · recuperação</p>
          </div>
          {hasReadiness && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary">{trend.readinessPointCount} dias</span>}
        </div>

        {hasReadiness ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.points} margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortDate" tick={{ fill: AXIS, fontSize: 9, fontWeight: 800 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis type="number" domain={[0, 2]} ticks={[0, 1, 2]} tick={<ReadinessTick />} tickLine={false} axisLine={false} width={68} />
                <ReferenceLine y={1} stroke="rgba(251,191,36,0.2)" strokeDasharray="3 3" />
                <Tooltip content={<ReadinessTooltip />} cursor={{ stroke: 'rgba(184,245,0,0.35)' }} />
                <Line type="stepAfter" dataKey="readinessLevel" stroke="#b8f500" strokeWidth={2.5} connectNulls={false} dot={<StatusDot />} activeDot={{ r: 5, fill: '#b8f500', stroke: '#171b1d', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart icon={BatteryWarning} title="Prontidão ainda sem histórico" message="Registre RPE, sono ou sensação em alguns treinos para formar a primeira linha de tendência. Os dias sem histórico ficam fora do gráfico." />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" /> pronto</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-300" /> controle</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-400" /> recuperação</span>
          <span className="flex items-center gap-1.5 text-on-surface-variant/60"><ShieldCheck className="h-3 w-3" /> sem score médico</span>
        </div>
      </section>
    </div>
  );
}
