import { Activity, AlertTriangle, CheckCircle2, Moon } from 'lucide-react';
import { TrainingFeeling } from '../types';

interface Props {
  rpe: number;
  feeling: TrainingFeeling | null;
  sleepHours: string;
}

/**
 * Feedback interpretativo local para o pós-treino.
 * Não grava dados, não altera o resultado e não faz diagnóstico.
 * Quando os dados são insuficientes, simplesmente não renderiza nada.
 */
export default function PostWorkoutInsight({ rpe, feeling, sleepHours }: Props) {
  const sleep = Number.parseFloat(sleepHours.replace(',', '.'));
  const hasSleep = Number.isFinite(sleep) && sleep > 0;

  let tone: 'attention' | 'positive' | 'neutral' = 'neutral';
  let title = 'Registro concluído';
  let message = 'Esses dados ajudam o BoxLink a entender seu padrão de treino.';
  let Icon = Activity;

  if (feeling === 'dor') {
    tone = 'attention';
    title = 'Priorize sua percepção corporal';
    message = 'Considere conversar com o coach antes de repetir intensidade alta. Este aviso não é um diagnóstico.';
    Icon = AlertTriangle;
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
      </div>
    </div>
  );
}
