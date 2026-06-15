/**
 * Calcula o estado de inatividade de um atleta baseado nos checkins
 * e nas configurações do admin.
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

/** Dias consecutivos sem check-in, contados de hoje para trás */
function consecutiveDaysWithout(checkins: { date: string }[]): number {
  const dates = new Set(checkins.map((c) => c.date));
  let days = 0;
  
  while (days <= 365) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    // ✅ CORREÇÃO: Usar São Paulo para calcular data (mesmo timezone que os check-ins são gravados)
    const str = d.toLocaleString('en-CA', { 
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    if (dates.has(str)) break;
    days++;
  }
  return days;
}

/**
 * Dias sem check-in dentro de uma janela de `maxDays` dias.
 */
function alternatedDaysWithout(checkins: { date: string }[], windowDays: number): number {
  const dates = new Set(checkins.map((c) => c.date));
  let missing = 0;
  
  for (let i = 0; i < windowDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // ✅ CORREÇÃO: Usar São Paulo para calcular data
    const str = d.toLocaleString('en-CA', { 
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    if (!dates.has(str)) missing++;
  }
  return missing;
}

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
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - settings.maxDays);
  
  // ✅ CORREÇÃO: Converter datas de string para Date para comparação correta
  const recentCheckins = checkins.filter((c) => {
    const [year, month, day] = c.date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d >= windowStart && d <= today;
  }).length;

  const recoveryFactor = Math.min(recentCheckins / settings.maxDays, 1);
  const finalFade = Math.max(rawFade - recoveryFactor, 0);

  const fadePercent = Math.round(Math.min(finalFade, 1) * 100);
  const showSleeping = fadePercent >= 30;

  return { inactiveDays, fadePercent, showSleeping };
}
