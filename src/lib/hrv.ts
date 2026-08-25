// ============================================================================
// Métricas de variabilidade da frequência cardíaca (HRV/VFC).
//
// O módulo trabalha somente com intervalos RR/IBI batimento a batimento.
// Amostras de BPM espaçadas não são convertidas em HRV, pois não preservam o
// instante de cada batimento.
// ============================================================================

export type HrvMetric = 'rmssd' | 'sdnn';
export type HrvQuality = 'good' | 'insufficient' | 'invalid';
export type HrvConfidence = 'high' | 'medium' | 'low';

export interface ParsedHeartRateMeasurement {
  bpm: number | null;
  rrIntervalsMs: number[];
}

export interface HrvMetrics {
  rmssdMs: number | null;
  sdnnMs: number | null;
  validIntervals: number;
  totalIntervals: number;
  quality: HrvQuality;
}

export interface HrvReadinessRecord {
  valueMs: number;
  metric: HrvMetric;
  at: string | null;
}

export interface HealthHrvSessionLike {
  source?: 'ble' | 'health' | null;
  hrv_rmssd_ms?: number | null;
  hrv_sdnn_ms?: number | null;
  hrv_metric?: HrvMetric | null;
  hrv_at?: string | null;
  ended_at?: string | null;
  started_at?: string | null;
}

/**
 * Converte apenas sessões vindas do app de saúde em registros de baseline.
 * HRV capturada em um WOD via BLE é mantida no resumo, mas não é misturada
 * com HRV de repouso para decidir prontidão.
 */
export function hrvRecordsFromHealthSessions(sessions: HealthHrvSessionLike[]): HrvReadinessRecord[] {
  return (Array.isArray(sessions) ? sessions : []).flatMap((session) => {
    if (session.source !== 'health') return [];
    const at = session.hrv_at ?? session.ended_at ?? session.started_at ?? null;
    const metric = session.hrv_metric;
    if (metric === 'sdnn' && Number.isFinite(session.hrv_sdnn_ms) && session.hrv_sdnn_ms! > 0) {
      return [{ valueMs: session.hrv_sdnn_ms!, metric: 'sdnn', at }];
    }
    if (metric === 'rmssd' && Number.isFinite(session.hrv_rmssd_ms) && session.hrv_rmssd_ms! > 0) {
      return [{ valueMs: session.hrv_rmssd_ms!, metric: 'rmssd', at }];
    }
    return [
      ...(Number.isFinite(session.hrv_rmssd_ms) && session.hrv_rmssd_ms! > 0
        ? [{ valueMs: session.hrv_rmssd_ms!, metric: 'rmssd' as const, at }]
        : []),
      ...(Number.isFinite(session.hrv_sdnn_ms) && session.hrv_sdnn_ms! > 0
        ? [{ valueMs: session.hrv_sdnn_ms!, metric: 'sdnn' as const, at }]
        : []),
    ];
  });
}

export interface HrvReadinessSignal {
  latestMs: number | null;
  baselineMs: number | null;
  deltaPct: number | null;
  baselineCount: number;
  metric: HrvMetric | null;
  latestAt: string | null;
  confidence: HrvConfidence;
}

const MIN_RR_MS = 250;
const MAX_RR_MS = 3000;
const MIN_INTERVALS_FOR_HRV = 10;
const MAX_SUCCESSIVE_DIFF_MS = 1200;

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** Intervalo RR plausível para uma medição de FC humana. */
export function isPlausibleRrIntervalMs(value: number): boolean {
  return isFiniteNumber(value) && value >= MIN_RR_MS && value <= MAX_RR_MS;
}

/**
 * Lê a característica padrão Heart Rate Measurement (0x2A37).
 *
 * Flags:
 * bit 0: BPM em UINT16 (caso contrário UINT8)
 * bit 3: campo Energy Expended presente
 * bit 4: um ou mais RR-Intervals presentes
 *
 * Cada RR-Interval é UINT16 little-endian em unidades de 1/1024 segundo.
 */
export function parseStandardHeartRateMeasurement(value: DataView): ParsedHeartRateMeasurement {
  if (value.byteLength < 2) return { bpm: null, rrIntervalsMs: [] };

  const flags = value.getUint8(0);
  const is16BitBpm = (flags & 0x01) !== 0;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrPresent = (flags & 0x10) !== 0;
  let offset = 1;

  let bpm: number;
  if (is16BitBpm) {
    if (value.byteLength < offset + 2) return { bpm: null, rrIntervalsMs: [] };
    bpm = value.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = value.getUint8(offset);
    offset += 1;
  }

  // Mantém a validação fisiológica do parser existente sem impedir a leitura
  // do RR quando o dispositivo envia um BPM inválido/transitório.
  const parsedBpm = isFiniteNumber(bpm) && bpm >= 30 && bpm <= 250 ? bpm : null;

  if (energyExpendedPresent) offset += 2;
  if (!rrPresent || offset >= value.byteLength) {
    return { bpm: parsedBpm, rrIntervalsMs: [] };
  }

  const rrIntervalsMs: number[] = [];
  for (; offset + 1 < value.byteLength; offset += 2) {
    const raw = value.getUint16(offset, true);
    const milliseconds = (raw * 1000) / 1024;
    if (isPlausibleRrIntervalMs(milliseconds)) rrIntervalsMs.push(milliseconds);
  }

  return { bpm: parsedBpm, rrIntervalsMs };
}

function cleanIntervals(rrIntervalsMs: number[]): number[] {
  return rrIntervalsMs.filter(isPlausibleRrIntervalMs);
}

/**
 * Calcula RMSSD e SDNN em milissegundos.
 * Valores que não têm intervalos suficientes retornam métricas nulas, em vez
 * de fabricar um score a partir de uma janela curta.
 */
export function calculateHrvMetrics(rrIntervalsMs: number[]): HrvMetrics {
  const totalIntervals = Array.isArray(rrIntervalsMs) ? rrIntervalsMs.length : 0;
  const valid = cleanIntervals(Array.isArray(rrIntervalsMs) ? rrIntervalsMs : []);
  const validIntervals = valid.length;

  if (validIntervals < MIN_INTERVALS_FOR_HRV) {
    return {
      rmssdMs: null,
      sdnnMs: null,
      validIntervals,
      totalIntervals,
      quality: validIntervals === 0 ? 'invalid' : 'insufficient',
    };
  }

  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / valid.length;
  const sdnnMs = Math.sqrt(variance);

  const successiveDifferences = valid
    .slice(1)
    .map((value, index) => value - valid[index])
    .filter((difference) => Math.abs(difference) <= MAX_SUCCESSIVE_DIFF_MS);
  const rmssdMs = successiveDifferences.length > 0
    ? Math.sqrt(successiveDifferences.reduce((sum, value) => sum + value ** 2, 0) / successiveDifferences.length)
    : null;

  return {
    rmssdMs: rmssdMs != null && isFiniteNumber(rmssdMs) ? Math.round(rmssdMs * 10) / 10 : null,
    sdnnMs: isFiniteNumber(sdnnMs) ? Math.round(sdnnMs * 10) / 10 : null,
    validIntervals,
    totalIntervals,
    quality: rmssdMs != null && isFiniteNumber(rmssdMs) ? 'good' : 'invalid',
  };
}

/**
 * Compara o valor mais recente com as três medições anteriores da mesma métrica.
 * Registros de SDNN e RMSSD nunca são misturados no mesmo baseline.
 */
export function calculateHrvReadinessSignal(records: HrvReadinessRecord[]): HrvReadinessSignal {
  const valid = (Array.isArray(records) ? records : [])
    .filter((record) =>
      record &&
      isFiniteNumber(record.valueMs) &&
      record.valueMs > 0 &&
      (record.metric === 'rmssd' || record.metric === 'sdnn')
    )
    .sort((a, b) => {
      const aAt = a.at ? new Date(a.at).getTime() : 0;
      const bAt = b.at ? new Date(b.at).getTime() : 0;
      return bAt - aAt;
    });

  const latest = valid[0];
  if (!latest) {
    return { latestMs: null, baselineMs: null, deltaPct: null, baselineCount: 0, metric: null, latestAt: null, confidence: 'low' };
  }

  const baseline = valid
    .filter((record) => record.metric === latest.metric)
    .slice(1, 4)
    .map((record) => record.valueMs);

  if (baseline.length < 3) {
    return {
      latestMs: latest.valueMs,
      baselineMs: null,
      deltaPct: null,
      baselineCount: baseline.length,
      metric: latest.metric,
      latestAt: latest.at,
      confidence: 'medium',
    };
  }

  const baselineMs = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
  const deltaPct = baselineMs > 0 ? ((latest.valueMs - baselineMs) / baselineMs) * 100 : null;
  return {
    latestMs: latest.valueMs,
    baselineMs,
    deltaPct,
    baselineCount: baseline.length,
    metric: latest.metric,
    latestAt: latest.at,
    confidence: 'high',
  };
}

export function hrvMetricLabel(metric: HrvMetric | null | undefined): string {
  return metric === 'sdnn' ? 'HRV (SDNN)' : metric === 'rmssd' ? 'HRV (RMSSD)' : 'HRV';
}
