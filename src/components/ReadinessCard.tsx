import { BatteryWarning, Gauge, Info, ShieldCheck } from 'lucide-react';
import type { ReadinessResult, ReadinessStatus } from '../lib/readiness';

interface Props {
  result: ReadinessResult;
}

const CONFIDENCE_LABEL: Record<ReadinessResult['confidence'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Inicial',
};

const FRESHNESS_LABEL: Record<ReadinessResult['freshness'], string> = {
  today: 'dados de hoje',
  recent: 'dados recentes',
  stale: 'dados antigos',
  unknown: 'data não informada',
};

const STATUS_CONFIG: Record<ReadinessStatus, {
  label: string;
  subtitle: string;
  icon: typeof ShieldCheck;
  container: string;
  iconBox: string;
  iconColor: string;
  labelColor: string;
}> = {
  ready: {
    label: 'Pronto para treinar',
    subtitle: 'Sem sinais relevantes de alerta',
    icon: ShieldCheck,
    container: 'bg-primary/10 border-primary/20',
    iconBox: 'bg-primary/15',
    iconColor: 'text-primary',
    labelColor: 'text-primary',
  },
  control: {
    label: 'Treine com controle',
    subtitle: 'Ajuste a intensidade se precisar',
    icon: Gauge,
    container: 'bg-secondary/10 border-secondary/20',
    iconBox: 'bg-secondary/15',
    iconColor: 'text-secondary',
    labelColor: 'text-secondary',
  },
  recovery: {
    label: 'Priorize recuperação',
    subtitle: 'Converse com o coach antes de forçar',
    icon: BatteryWarning,
    container: 'bg-red-500/10 border-red-500/25',
    iconBox: 'bg-red-500/15',
    iconColor: 'text-red-400',
    labelColor: 'text-red-300',
  },
};

export default function ReadinessCard({ result }: Props) {
  const config = STATUS_CONFIG[result.status];
  const Icon = config.icon;
  const messages = result.messages.slice(0, 2);

  return (
    <section className={`rounded-3xl border p-4 ${config.container}`} aria-label="Prontidão para treinar">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${config.iconBox}`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-[10px] font-black uppercase tracking-widest ${config.labelColor}`}>Prontidão de hoje</p>
            {!result.hasEnoughHistory && <Info className="w-3.5 h-3.5 text-on-surface-variant" aria-label="Histórico insuficiente" />}
          </div>
          <h2 className="text-lg font-headline font-black text-on-surface uppercase italic leading-tight mt-0.5">{config.label}</h2>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">{config.subtitle}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[9px] font-black uppercase tracking-wider text-on-surface-variant">
            <span>Confiança {CONFIDENCE_LABEL[result.confidence]}</span>
            <span aria-hidden="true">•</span>
            <span>{FRESHNESS_LABEL[result.freshness]}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pl-[52px] flex flex-col gap-1.5">
        {messages.map((message) => (
          <p key={message} className="text-[11px] text-on-surface-variant font-bold leading-snug">{message}</p>
        ))}
        <div className="mt-1 rounded-2xl bg-surface/40 px-3 py-2 text-[9px] text-on-surface-variant font-bold leading-relaxed">
          <p>
            <span className="text-on-surface">Baseado em:</span>{' '}
            {result.signalsUsed.length > 0 ? result.signalsUsed.join(' • ') : 'nenhum feedback registrado'}.
          </p>
          <p className="mt-0.5">
            <span className="text-on-surface">Histórico:</span>{' '}
            {result.sampleCounts.rpe} RPE · {result.sampleCounts.sleep} registros de sono · {result.sampleCounts.cardio} sessões de FC comparáveis.
          </p>
        </div>
      </div>
    </section>
  );
}
