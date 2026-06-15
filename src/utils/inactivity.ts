/**
 * Calcula o estado de inatividade de um atleta baseado nos checkins
 * e nas configurações do admin.
 *
 * Lógica base: atleta saudável treina 3x/semana (~1 treino a cada 2-3 dias).
 * Sugestão de defaults: startDays=4, maxDays=14.
 *
 * Recuperação gradual: cada treino feito recupera (100 / maxDays) % de cor.
 */

export type InactivityMode = 'consecutive' | 'alternated';

export interface InactivitySettings {
  enabled: boolean;
  mode: InactivityMode;   // 'consecutive' = dias seguidos | 'alternated' = dias no período
  startDays: number;      // a partir de quantos dias começa o efeito
  maxDays: number;        // quantos dias até atingir cinza total (100%)
}

export interface InactivityState {
  inactiveDays: number;   // dias inativos calculados
  fadePercent: number;    // 0 = cor normal | 100 = totalmente cinza
  showSleeping: boolean;  // mostrar ícone 💤
}

/**
 * Retorna a data de hoje no fuso de São Paulo (America/Sao_Paulo)
 * no formato YYYY-MM-DD, sem depender de UTC.
 */
function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Retorna a data de N dias atrás no fuso de São Paulo, formato YYYY-MM-DD.
 */
function daysBefore(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Dias consecutivos sem check-in, contados de hoje para trás */
function consecutiveDaysWithout(checkins: { date: string }[]): number {
  const dates = new Set(checkins.map((c) => c.date));
  let days = 0;
  while (days <= 365) {
    const str = daysBefore(days);
    if (dates.has(str)) break;
    days++;
  }
  return days;
}

/**
 * Dias sem check-in dentro de uma janela de `windowDays` dias.
 * Ex: em 14 dias, quantos dias não teve treino.
 */
function alternatedDaysWithout(checkins: { date: string }[], windowDays: number): number {
  const dates = new Set(checkins.map((c) => c.date));
  let missing = 0;
  for (let i = 0; i < windowDays; i++) {
    const str = daysBefore(i);
    if (!dates.has(str)) missing++;
  }
  return missing;
}

/**
 * Calcula o fadePercent atual.
 * A recuperação é gradual: cada treino feito nos últimos `maxDays` dias
 * "devolve" uma fatia da cor de volta.
 */
export function calcInactivity(
  checkins: { date: string }[],
  settings: InactivitySettings
): InactivityState {
  if (!settings.enabled) {
    return { inactiveDays: 0, fadePercent: 0, showSleeping: false };
  }

  const inactiveDays =
    settings.mode === 'consecutive'
      ? consecutiveDaysWithout(checkins)
      : alternatedDaysWithout(checkins, settings.maxDays);

  if (inactiveDays < settings.startDays) {
    return { inactiveDays, fadePercent: 0, showSleeping: false };
  }

  const range = Math.max(settings.maxDays - settings.startDays, 1);
  const rawFade = (inactiveDays - settings.startDays) / range;

  // Recuperação gradual: cada treino nos últimos maxDays recupera 1/maxDays do fade
  const windowStart = daysBefore(settings.maxDays);
  const today = todayBR();
  const recentCheckins = checkins.filter((c) => {
    return c.date >= windowStart && c.date <= today;
  }).length;

  // Cada treino recente recupera (1/maxDays) de fade — quanto mais treinos, menos cinza
  const recoveryFactor = Math.min(recentCheckins / settings.maxDays, 1);
  const finalFade = Math.max(rawFade - recoveryFactor, 0);

  const fadePercent = Math.round(Math.min(finalFade, 1) * 100);
  const showSleeping = fadePercent >= 30;

  return { inactiveDays, fadePercent, showSleeping };
}
