import type { StoredHrSession } from './heartRateSessions';
import { assessHrSessionQuality } from './heartRateSessions';

export type CardioConfidence = 'high' | 'medium' | 'low';

export interface CardioReadinessSignal {
  latestLoad: number | null;
  baselineLoad: number | null;
  deltaPct: number | null;
  baselineCount: number;
  confidence: CardioConfidence;
}

const ZONE_WEIGHTS = [1, 2, 3, 4, 5];

/**
 * Converte o esforço cardiovascular já registrado em uma carga comparável.
 * Quando o resumo antigo não tem `effort`, recompõe a carga a partir do tempo
 * por zona. Sessões sem qualidade mínima não entram na comparação.
 */
export function calculateCardioLoad(session: Pick<StoredHrSession, 'effort' | 'zone_secs' | 'duration_sec' | 'samples'>): number | null {
  const quality = assessHrSessionQuality(session);
  if (!quality.usableForWod) return null;

  const storedEffort = Number(session.effort);
  if (Number.isFinite(storedEffort) && storedEffort > 0) return storedEffort;

  const zones = Array.isArray(session.zone_secs) ? session.zone_secs : [];
  const load = zones.reduce((total, seconds, index) => {
    const value = Number(seconds);
    const weight = ZONE_WEIGHTS[index] ?? ZONE_WEIGHTS[ZONE_WEIGHTS.length - 1];
    return total + (Number.isFinite(value) && value > 0 ? (value / 60) * weight : 0);
  }, 0);
  return load > 0 ? Math.round(load) : null;
}

/**
 * Calcula o sinal cardiovascular usando a sessão mais recente vinculada ao
 * WOD e as sessões anteriores vinculadas como baseline do próprio aluno.
 * Exige três sessões anteriores válidas para evitar conclusões frágeis.
 */
export function calculateCardioReadinessSignal(
  sessions: StoredHrSession[],
  linkedSessionIds: Set<string>,
): CardioReadinessSignal {
  const valid = sessions
    .filter(session => linkedSessionIds.has(session.id))
    .map(session => ({ session, load: calculateCardioLoad(session) }))
    .filter((item): item is { session: StoredHrSession; load: number } => item.load != null)
    .sort((a, b) => {
      const aDate = new Date(a.session.ended_at || a.session.started_at || 0).getTime();
      const bDate = new Date(b.session.ended_at || b.session.started_at || 0).getTime();
      return bDate - aDate;
    });

  const latest = valid[0];
  const baseline = valid.slice(1, 4).map(item => item.load);
  if (!latest || baseline.length < 3) {
    return {
      latestLoad: latest?.load ?? null,
      baselineLoad: null,
      deltaPct: null,
      baselineCount: baseline.length,
      confidence: latest ? 'medium' : 'low',
    };
  }

  const baselineLoad = baseline.reduce((sum, load) => sum + load, 0) / baseline.length;
  const deltaPct = baselineLoad > 0 ? ((latest.load - baselineLoad) / baselineLoad) * 100 : null;
  return {
    latestLoad: latest.load,
    baselineLoad,
    deltaPct,
    baselineCount: baseline.length,
    confidence: 'high',
  };
}
