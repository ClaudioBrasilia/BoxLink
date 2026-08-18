import { Activity, AlertTriangle, CheckCircle2, Moon } from 'lucide-react';
import { TrainingFeeling } from '../types';

interface Props {
  rpe: number;
  feeling: TrainingFeeling | null;
  sleepHours: string;
  baseline?: {
    avgRpe: number;
    avgSleep: number;
    rpeCount: number;
    sleepCount: number;
  } | null;
}

/**
 * Feedback interpretativo local para o pós-treino.
 * Não grava dados, não altera o resultado e não faz diagnóstico.
 * Quando os dados são insuficientes, simplesmente não renderiza nada.
 */
export default function PostWorkoutInsight({ rpe, feeling, sleepHours, baseline }: Props) {
  const sleep = Number.parseFloat(sleepHours.replace(',', '.'));
  const hasSleep = Number.isFinite(sleep) && sleep > 0;

  let tone: 'attention' | 'positive' | 'neutral' = 'neutral';
  let title = 'Registro concluído';
  let message = 'Esses dados ajudam o BoxLink a entender seu padrão de treino.';
  let Icon = Activity;

  const rpeAboveBaseline = Boolean(baseline && baseline.rpeCount >= 3 && rpe > 0 && rpe >= baseline.avgRpe + 1.5);
  const sleepBelowBaseline = Boolean(baseline && baseline.sleepCount >= 3 && hasSleep && sleep <= baseline.avgSleep - 1);

  if (feeling === 'dor') {
    tone = 'attention';
    title = 'Priorize sua percepção corporal';
    message = 'Considere conversar com o coach antes de repetir intensidade alta. Este aviso não é um diagnóstico.';
    Icon = AlertTriangle;
  } else if (rpeAboveBaseline) {
    tone = 'attention';
    title = 'Esforço acima do seu padrão';
    message = `Seu RPE ${rpe}/10 ficou acima da sua média recente (${baseline!.avgRpe.toFixed(1)}/10). Considere controlar a intensidade e priorizar a recuperação.`;
    Icon = AlertTriangle;
  } else if (sleepBelowBaseline) {
    tone = 'neutral';
    title = 'Sono abaixo do seu padrão';
    message = `Você registrou ${sleep.toFixed(1)}h, abaixo da sua média recente (${baseline!.avgSleep.toFixed(1)}h). Observe sua resposta e ajuste a intensidade se necessário.`;
    Icon = Moon;
  } else if (rpe >= 8 || feeling === 'cansado' || (hasSleep && sleep < 6)) {
    tone = 'attention';
    title = 'Treino exigente para o seu momento';
    message = 'Pode ser um bom dia para reduzir a intensidade, caprichar na recuperação ou seguir a escala indicada pelo coach.';
    Icon = AlertTriangle;
  } else if (rpe > 0 && rpe <= 5 && (feeling === 'otimo' || feeling === 'bem')) {
    tone = 'positive';
    title = 'Boa resposta ao treino';
    message = 'Seu registro indica uma sessão bem tolerada. Use isso como referência para acompanhar sua evolução.';
    Icon = CheckCircle2;
  } else if (hasSleep && sleep < 7) {
    tone = 'neutral';
    title = 'Sono pode influenciar sua próxima sessão';
    message = 'Observe como seu corpo responde e ajuste a intensidade se necessário.';
    Icon = Moon;
  }

  const colors = tone === 'attention'
    ? 'border-secondary/30 bg-secondary/10 text-secondary'
    : tone === 'positive'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : 'border-outline-variant/20 bg-surface-container-highest/60 text-on-surface-variant';

  return (
    <div className={`rounded-2xl border px-4 py-3 flex items-start gap-3 ${colors}`} role="status" aria-live="polite">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-[11px] leading-snug mt-1 text-on-surface-variant">{message}</p>
        {baseline && (baseline.rpeCount >= 3 || baseline.sleepCount >= 3) && (
          <p className="text-[9px] leading-snug mt-1 text-on-surface-variant/70">Comparação baseada no seu histórico recente.</p>
        )}
      </div>
    </div>
  );
}
