// ============================================================================
// Regras puras da sessão BLE nativa (Android Foreground Service / iOS Core
// Bluetooth). Ficam separadas do hook para poderem ser testadas sem React e
// sem carregar o bridge do Capacitor.
// ============================================================================
import type { BleForegroundSample, BleForegroundSession } from './bleForeground';

/**
 * Uma sessão marcada como ativa mas sem leituras por mais que isso indica um
 * serviço que morreu (force-stop, reboot, kill do fabricante) deixando o
 * registro local órfão.
 */
export const NATIVE_SESSION_STALE_MS = 120_000;

/** Une amostras nativas deduplicando pelo instante de captura. */
export function mergeBleSamples(
  current: BleForegroundSample[],
  incoming: BleForegroundSample[],
): BleForegroundSample[] {
  const byTimestamp = new Map<number, BleForegroundSample>();
  for (const sample of [...current, ...incoming]) {
    if (!Number.isFinite(sample.capturedAtMs) || !Number.isFinite(sample.bpm)) continue;
    byTimestamp.set(sample.capturedAtMs, sample);
  }
  return Array.from(byTimestamp.values()).sort((a, b) => a.capturedAtMs - b.capturedAtMs);
}

/**
 * Filtra o que ainda não foi aplicado ao estado React. Aplicar duas vezes a
 * mesma amostra duplicaria seus intervalos RR e distorceria a HRV da sessão.
 */
export function selectNewBleSamples(
  samples: BleForegroundSample[],
  afterMs: number,
): BleForegroundSample[] {
  return samples.filter(
    (sample) => Number.isFinite(sample.capturedAtMs) && sample.capturedAtMs > afterMs,
  );
}

/** Maior instante de captura entre as amostras, nunca menor que `fallback`. */
export function latestSampleAt(samples: BleForegroundSample[], fallback = 0): number {
  return samples.reduce(
    (max, sample) => (Number.isFinite(sample.capturedAtMs) ? Math.max(max, sample.capturedAtMs) : max),
    fallback,
  );
}

/**
 * Sessão ativa no registro nativo, porém sem sinal de vida. Exibi-la como
 * "conectada" mostraria um treino que ninguém está alimentando.
 */
export function isNativeSessionStale(
  session: Pick<BleForegroundSession, 'active' | 'lastSampleMs' | 'startedAtMs'>,
  nowMs: number,
  staleAfterMs: number = NATIVE_SESSION_STALE_MS,
): boolean {
  if (!session.active) return false;
  const lastActivityAt = session.lastSampleMs ?? session.startedAtMs ?? 0;
  if (!lastActivityAt || !Number.isFinite(lastActivityAt)) return false;
  return nowMs - lastActivityAt > staleAfterMs;
}
