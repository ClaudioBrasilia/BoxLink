// src/lib/rewardRetention.ts
// Controle da limpeza automática do histórico de recompensas.
//
// A limpeza roda no banco (`prune_my_reward_history`), mas precisa de um
// gatilho: o app chama a função quando o atleta abre o Perfil, no máximo uma vez
// por dia. A marca do último dia fica no localStorage — aqui ficam só as regras,
// testáveis com um storage de mentira.

/** Janela padrão: dois meses de histórico na lista. */
export const DEFAULT_KEEP_DAYS = 60;

/** Menor janela aceita — evita apagar o mês corrente por engano. */
export const MIN_KEEP_DAYS = 30;

export type RetentionStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function pruneMarkerKey(userId: string): string {
  return `boxlink:reward-prune:${userId || 'anon'}`;
}

/** Data local no formato YYYY-MM-DD, que é o que fica gravado na marca. */
export function todayStamp(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA');
}

/** Já rodou hoje? Se a marca estiver corrompida, roda de novo (é idempotente). */
export function shouldPruneToday(
  storage: RetentionStorage | null | undefined,
  key: string,
  today: string = todayStamp(),
): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(key) !== today;
  } catch {
    return true;
  }
}

export function markPruneDone(
  storage: RetentionStorage | null | undefined,
  key: string,
  today: string = todayStamp(),
): void {
  if (!storage) return;
  try {
    storage.setItem(key, today);
  } catch {
    // Modo privado do navegador pode bloquear: a limpeza roda de novo, sem dano.
  }
}

/** Normaliza a janela escolhida pelo atleta. */
export function clampKeepDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_KEEP_DAYS;
  return Math.max(MIN_KEEP_DAYS, Math.round(days));
}

/** Texto curto da janela: "60 dias" ou "2 meses" quando fecha redondo. */
export function keepWindowLabel(days: number): string {
  const safe = clampKeepDays(days);
  if (safe % 30 === 0 && safe >= 30) {
    const months = safe / 30;
    return months === 1 ? '1 mês' : `${months} meses`;
  }
  return `${safe} dias`;
}
