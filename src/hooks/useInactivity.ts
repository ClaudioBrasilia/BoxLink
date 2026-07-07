/**
 * Calcula o estado de inatividade de um atleta baseado nos checkins
 * e nas configurações do admin.
 *
 * Regra: o atleta precisa ter pelo menos `minWorkoutsPerWeek` treinos
 * numa janela móvel dos últimos 7 dias. Se `excludeSunday` estiver
 * ativo, domingo não é contado (nem como dia exigido, nem como treino
 * válido para a meta) — ou seja, a semana "útil" tem 6 dias.
 *
 * O retorno da inatividade é automático: assim que o atleta acumular
 * treinos suficientes dentro da janela dos últimos 7 dias, o fade some.
 */

export interface InactivitySettings {
  enabled: boolean;
  minWorkoutsPerWeek: number; // padrão 3
  excludeSunday: boolean;     // padrão true — domingo não conta
}

export interface InactivityState {
  checkinsInWindow: number;   // treinos válidos nos últimos 7 dias
  requiredWorkouts: number;   // meta (settings.minWorkoutsPerWeek)
  missingWorkouts: number;    // quantos faltam para bater a meta
  fadePercent: number;        // 0 = cor normal | 100 = totalmente cinza
  showSleeping: boolean;      // mostrar ícone 💤
}

const WINDOW_DAYS = 7;

/** Retorna o dia da semana (0=domingo) de uma data, no timezone de São Paulo */
function weekdayInSaoPaulo(d: Date): number {
  const spString = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(spString).getDay();
}

/** Data (yyyy-MM-dd) no timezone de São Paulo */
function dateStrInSaoPaulo(d: Date): string {
  return d.toLocaleString('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function calcInactivity(
  checkins: { date: string }[],
  settings: InactivitySettings
): InactivityState {
  const required = Math.max(settings?.minWorkoutsPerWeek || 3, 1);

  if (!settings?.enabled) {
    return { checkinsInWindow: 0, requiredWorkouts: required, missingWorkouts: 0, fadePercent: 0, showSleeping: false };
  }

  const dates = new Set(checkins.map((c) => c.date));

  let checkinsInWindow = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    // Domingo não conta como dia exigido nem como treino válido para a meta
    if (settings.excludeSunday && weekdayInSaoPaulo(d) === 0) continue;

    const str = dateStrInSaoPaulo(d);
    if (dates.has(str)) checkinsInWindow++;
  }

  const missingWorkouts = Math.max(required - checkinsInWindow, 0);
  const fadePercent = Math.round(Math.min(missingWorkouts / required, 1) * 100);
  // 💤 só aparece quando o atleta não treinou nenhuma vez na janela
  const showSleeping = checkinsInWindow === 0;

  return { checkinsInWindow, requiredWorkouts: required, missingWorkouts, fadePercent, showSleeping };
}
