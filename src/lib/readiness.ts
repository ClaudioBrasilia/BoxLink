import type { TrainingFeeling } from '../types';

export type ReadinessStatus = 'ready' | 'control' | 'recovery';
export type ReadinessReasonCode =
  | 'pain'
  | 'consecutive_tired'
  | 'short_sleep_high_rpe'
  | 'rpe_above_baseline'
  | 'consecutive_high_rpe'
  | 'tired'
  | 'short_sleep'
  | 'sleep_below_baseline'
  | 'high_rpe'
  | 'rpe_above_normal'
  | 'no_alerts'
  | 'insufficient_history';

export interface ReadinessInput {
  latestFeeling?: TrainingFeeling | null;
  consecutiveTired?: number;
  latestRpe?: number | null;
  averageRpe?: number | null;
  latestSleepHours?: number | null;
  averageSleepHours?: number | null;
  consecutiveHighRpe?: number;
  consecutiveTrainingDays?: number;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  reasons: ReadinessReasonCode[];
  messages: string[];
  hasEnoughHistory: boolean;
}

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function hasBaseline(value: number | null | undefined): boolean {
  return finite(value) != null;
}

/**
 * Calcula a prontidão do aluno sem efeitos colaterais.
 *
 * A precedência é deliberadamente conservadora:
 * 1) sinais críticos geram recovery;
 * 2) sinais moderados geram control;
 * 3) na ausência de alertas, o aluno fica ready.
 *
 * O resultado é orientação de produto, não diagnóstico médico.
 */
export function calculateReadiness(input: ReadinessInput): ReadinessResult {
  const latestRpe = finite(input.latestRpe);
  const averageRpe = finite(input.averageRpe);
  const latestSleep = finite(input.latestSleepHours);
  const averageSleep = finite(input.averageSleepHours);
  const consecutiveTired = Math.max(0, input.consecutiveTired ?? 0);
  const consecutiveHighRpe = Math.max(0, input.consecutiveHighRpe ?? 0);
  const consecutiveTrainingDays = Math.max(0, input.consecutiveTrainingDays ?? 0);
  const hasEnoughHistory = hasBaseline(averageRpe) || hasBaseline(averageSleep) || consecutiveTired >= 2;

  const critical: ReadinessReasonCode[] = [];
  if (input.latestFeeling === 'dor') critical.push('pain');
  if (consecutiveTired >= 2) critical.push('consecutive_tired');
  if (latestSleep != null && latestSleep < 6 && latestRpe != null && latestRpe >= 8) {
    critical.push('short_sleep_high_rpe');
  }
  if (latestRpe != null && averageRpe != null && latestRpe - averageRpe >= 2) {
    critical.push('rpe_above_baseline');
  }
  if (consecutiveHighRpe >= 3) critical.push('consecutive_high_rpe');

  if (critical.length > 0) {
    return {
      status: 'recovery',
      reasons: critical,
      messages: critical.map(reasonMessage),
      hasEnoughHistory,
    };
  }

  const moderate: ReadinessReasonCode[] = [];
  if (input.latestFeeling === 'cansado') moderate.push('tired');
  if (latestSleep != null && latestSleep >= 6 && latestSleep < 7) moderate.push('short_sleep');
  if (latestSleep != null && averageSleep != null && averageSleep - latestSleep >= 1) {
    moderate.push('sleep_below_baseline');
  }
  if (latestRpe != null && latestRpe >= 7) moderate.push('high_rpe');
  if (latestRpe != null && averageRpe != null && latestRpe - averageRpe >= 1.5) {
    moderate.push('rpe_above_normal');
  }
  if (consecutiveTrainingDays >= 6) moderate.push('high_rpe');

  if (moderate.length > 0) {
    return {
      status: 'control',
      reasons: [...new Set(moderate)],
      messages: [...new Set(moderate)].map(reasonMessage),
      hasEnoughHistory,
    };
  }

  const reasons: ReadinessReasonCode[] = hasEnoughHistory ? ['no_alerts'] : ['insufficient_history'];
  return {
    status: 'ready',
    reasons,
    messages: reasons.map(reasonMessage),
    hasEnoughHistory,
  };
}

function reasonMessage(reason: ReadinessReasonCode): string {
  switch (reason) {
    case 'pain': return 'Há registro de dor no último treino.';
    case 'consecutive_tired': return 'Você registrou cansaço em treinos consecutivos.';
    case 'short_sleep_high_rpe': return 'O sono ficou abaixo de 6 horas junto com esforço muito alto.';
    case 'rpe_above_baseline': return 'O esforço ficou pelo menos 2 pontos acima da sua média recente.';
    case 'consecutive_high_rpe': return 'Você teve três sessões consecutivas com esforço muito alto.';
    case 'tired': return 'Você registrou cansaço no último treino.';
    case 'short_sleep': return 'O sono ficou entre 6 e 7 horas.';
    case 'sleep_below_baseline': return 'O sono ficou pelo menos 1 hora abaixo da sua média recente.';
    case 'high_rpe': return 'O esforço recente foi alto ou houve muitos dias seguidos de treino.';
    case 'rpe_above_normal': return 'O esforço ficou acima do seu padrão recente.';
    case 'no_alerts': return 'Não há sinais relevantes de alerta no seu histórico recente.';
    case 'insufficient_history': return 'Ainda não há histórico suficiente; complete seus feedbacks para personalizar a orientação.';
  }
}
