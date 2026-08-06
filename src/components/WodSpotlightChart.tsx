// src/components/WodSpotlightChart.tsx
// O gráfico de destaque do WOD — o MESMO na TV e no celular.
//
// Barras indexadas do líder contra a média do box, com a vantagem em % à
// direita, no formato das análises de atleta do CrossFit Games. As duas
// variantes mudam só o tamanho e o arranjo: na TV o rótulo fica ao lado das
// barras (tem largura sobrando); no celular ele vai acima, para as barras
// aproveitarem a tela inteira.

import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import AthletePhoto from './AthletePhoto';
import {
  WodSpotlightData,
  SpotlightMetric,
  buildSpotlightMetrics,
  computeSpotlightEdges,
  metricAdvantage,
} from '../lib/wodSpotlight';

// Cores literais (não tokens) para o gráfico ficar idêntico nos dois lugares.
const ATHLETE_GRADIENT = 'linear-gradient(90deg,#facc15,#4ade80)';
const BOX_GRADIENT = 'linear-gradient(90deg,#38bdf8,#7dd3fc)';
const TITLE_GRADIENT = 'linear-gradient(90deg,#facc15,#4ade80,#22d3ee)';

interface WodSpotlightChartProps {
  data: WodSpotlightData;
  variant?: 'tv' | 'mobile';
  /** Nome de exibição do outro lado da comparação (cabeçalho). Padrão: "Média do Box". */
  comparisonName?: string;
  /** Rótulo curto pras barras (ex.: "BOX" ou o primeiro nome de um atleta). */
  comparisonShortName?: string;
  /** Texto do selo no canto superior direito. Padrão: "Líder do WOD". */
  badgeLabel?: string;
}

export default function WodSpotlightChart({
  data, variant = 'tv', comparisonName = 'Média do Box', comparisonShortName = 'BOX', badgeLabel = 'Líder do WOD',
}: WodSpotlightChartProps) {
  const isTv = variant === 'tv';
  const firstName = data.athlete.name.split(' ')[0].toUpperCase();
  const metrics = buildSpotlightMetrics(data);
  const edges = computeSpotlightEdges(metrics);

  const subtitle = `${data.wodName} • ${data.wodType} — ${data.athleteCount} atleta${data.athleteCount !== 1 ? 's' : ''} no placar`;

  if (isTv) {
    return (
      <div className="h-full flex flex-col gap-5">
        <Header firstName={firstName} subtitle={subtitle} badgeLabel={badgeLabel} isTv />

        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          <div className="col-span-3 bg-white/5 rounded-[2rem] border border-white/10 p-6 flex flex-col items-center justify-center gap-4">
            <AthletePhoto photoUrl={data.athlete.photoUrl} name={data.athlete.name}
              size="xl" ringColor="border-primary" className="shadow-[0_0_40px_rgba(202,253,0,0.25)]" />
            <div className="text-center">
              <p className="text-white text-2xl font-headline font-black uppercase italic leading-none">{firstName}</p>
              <p className="text-primary text-3xl font-headline font-black italic tabular-nums mt-2 leading-none">{data.leaderResult}</p>
              <p className="text-white/30 text-[9px] font-black uppercase tracking-widest mt-1">Melhor do dia</p>
            </div>
          </div>

          <div className="col-span-9 bg-white/5 rounded-[2rem] border border-white/10 p-6 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <span className="text-yellow-400 text-xs font-black uppercase tracking-widest">{firstName} vs Média do Box</span>
              <span className="text-white/30 text-[9px] font-black uppercase tracking-widest text-right leading-tight">
                Comparação indexada<br />Valores reais exibidos
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-around py-2">
              {metrics.map(m => <TvBar key={m.key} metric={m} name={firstName} comparisonShortName={comparisonShortName} />)}
            </div>
          </div>
        </div>

        {edges.length > 0 && <EdgeBanner firstName={firstName} edges={edges} isTv />}
      </div>
    );
  }

  // ── Celular ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-4 flex flex-col gap-4">
      <Header firstName={firstName} subtitle={subtitle} badgeLabel={badgeLabel} />

      <div className="flex items-center gap-3 bg-surface-container-highest/40 rounded-2xl p-3">
        <AthletePhoto photoUrl={data.athlete.photoUrl} name={data.athlete.name}
          size="md" ringColor="border-primary" />
        <div className="min-w-0">
          <p className="text-on-surface text-sm font-headline font-black uppercase italic leading-none truncate">{firstName}</p>
          <p className="text-primary text-2xl font-headline font-black italic tabular-nums leading-none mt-1">{data.leaderResult}</p>
          <p className="text-on-surface-variant/60 text-[8px] font-black uppercase tracking-widest mt-1">Melhor do dia</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {metrics.map(m => <MobileBar key={m.key} metric={m} name={firstName} comparisonShortName={comparisonShortName} />)}
      </div>

      {edges.length > 0 && <EdgeBanner firstName={firstName} edges={edges} />}
    </div>
  );
}

function Header({ firstName, subtitle, badgeLabel, isTv }: { firstName: string; subtitle: string; badgeLabel: string; isTv?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', isTv && 'shrink-0')}>
      <div className="min-w-0">
        {/* Na TV o título "ONDE X SE SEPARA" foi removido a pedido — fica só
            o subtítulo (WOD + contagem) maior, para não deixar o cabeçalho
            vazio. No celular o título continua: ali ele é o gancho da tela e
            quebra em duas linhas em vez de truncar. */}
        {!isTv && (
          <h2 className="font-headline font-black uppercase italic tracking-tighter leading-none text-lg"
            style={{ background: TITLE_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ONDE {firstName} SE SEPARA
          </h2>
        )}
        <p className={cn('font-black uppercase tracking-[0.2em] italic',
          isTv ? 'text-white/70 text-xl mt-0' : 'text-on-surface-variant text-[9px] leading-snug mt-1')}>
          {subtitle}
        </p>
      </div>
      <div className={cn('bg-primary/10 border border-primary/20 rounded-2xl flex items-center gap-2 shrink-0',
        isTv ? 'px-4 py-2' : 'px-2.5 py-1.5')}>
        <Trophy className={cn('text-primary', isTv ? 'w-5 h-5' : 'w-3.5 h-3.5')} />
        <span className={cn('text-primary font-black uppercase italic', isTv ? 'text-xs' : 'text-[9px]')}>
          {badgeLabel}
        </span>
      </div>
    </div>
  );
}

function EdgeBanner({ firstName, edges, isTv }: {
  firstName: string; edges: { pct: number; word: string }[]; isTv?: boolean;
}) {
  return (
    <div className={cn('bg-primary/10 border border-primary/20 rounded-2xl text-center',
      isTv ? 'px-6 py-3 shrink-0' : 'px-4 py-2.5')}>
      <span className={cn('text-primary font-black uppercase italic tracking-wide',
        isTv ? 'text-base' : 'text-[10px] leading-snug')}>
        A vantagem de {firstName}: {edges.map(e => `${e.pct.toFixed(1)}% ${e.word}`).join(' • ')}
      </span>
    </div>
  );
}

/** Larguras das duas barras, proporcionais ao maior valor da métrica. */
function barWidths(metric: SpotlightMetric) {
  const max = Math.max(metric.mine, metric.avg) || 1;
  return {
    minePct: Math.max(8, (metric.mine / max) * 100),
    avgPct: Math.max(8, (metric.avg / max) * 100),
  };
}

function Bar({ gradient, widthPct, label, delay }: {
  gradient: string; widthPct: number; label: string; delay?: number;
}) {
  return (
    <div className="flex-1 h-7 bg-white/5 rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full flex items-center justify-end pr-3"
        style={{ background: gradient }}
        initial={{ width: 0 }} animate={{ width: `${widthPct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut', delay }}>
        <span className="text-black text-xs font-black tabular-nums whitespace-nowrap">{label}</span>
      </motion.div>
    </div>
  );
}

function TvBar({ metric, name, comparisonShortName }: { metric: SpotlightMetric; name: string; comparisonShortName: string }) {
  const { minePct, avgPct } = barWidths(metric);
  const { better, diffPct } = metricAdvantage(metric);

  return (
    <div className="grid grid-cols-12 gap-4 items-center">
      <div className="col-span-3 min-w-0">
        <p className="text-white text-sm font-black uppercase tracking-tight leading-tight truncate">{metric.label}</p>
        <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">{metric.unit}</p>
      </div>

      <div className="col-span-7 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-[8px] font-black uppercase tracking-widest w-14 shrink-0 truncate">{name}</span>
          <Bar gradient={ATHLETE_GRADIENT} widthPct={minePct} label={metric.mineLabel} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-[8px] font-black uppercase tracking-widest w-14 shrink-0 truncate">{comparisonShortName}</span>
          <Bar gradient={BOX_GRADIENT} widthPct={avgPct} label={metric.avgLabel} delay={0.1} />
        </div>
      </div>

      <div className="col-span-2 text-center">
        <p className={cn('text-3xl font-headline font-black italic tabular-nums leading-none',
          better ? 'text-primary' : 'text-white/40')}>
          {diffPct.toFixed(1)}%
        </p>
        <p className={cn('text-[8px] font-black uppercase tracking-widest mt-1',
          better ? 'text-primary/70' : 'text-white/30')}>
          {better ? metric.betterWord : metric.worseWord}
        </p>
      </div>
    </div>
  );
}

/** No celular o rótulo sobe para o topo e as barras usam a largura toda. */
function MobileBar({ metric, name, comparisonShortName }: { metric: SpotlightMetric; name: string; comparisonShortName: string }) {
  const { minePct, avgPct } = barWidths(metric);
  const { better, diffPct } = metricAdvantage(metric);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-on-surface text-xs font-black uppercase tracking-tight leading-tight truncate">{metric.label}</p>
          <p className="text-on-surface-variant/60 text-[8px] font-black uppercase tracking-widest">{metric.unit}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn('text-xl font-headline font-black italic tabular-nums leading-none',
            better ? 'text-primary' : 'text-on-surface-variant/50')}>
            {diffPct.toFixed(1)}%
          </p>
          <p className={cn('text-[8px] font-black uppercase tracking-widest',
            better ? 'text-primary/70' : 'text-on-surface-variant/40')}>
            {better ? metric.betterWord : metric.worseWord}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-[8px] font-black uppercase tracking-widest w-12 shrink-0 truncate">{name}</span>
        <Bar gradient={ATHLETE_GRADIENT} widthPct={minePct} label={metric.mineLabel} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-cyan-400 text-[8px] font-black uppercase tracking-widest w-12 shrink-0 truncate">{comparisonShortName}</span>
        <Bar gradient={BOX_GRADIENT} widthPct={avgPct} label={metric.avgLabel} delay={0.1} />
      </div>
    </div>
  );
}
