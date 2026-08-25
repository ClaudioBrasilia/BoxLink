import type { HrvMetric } from './hrv';

export type HrvSourceKind = 'ble' | 'apple_health' | 'health_connect';
export type HrvValidationStatus =
  | 'valid'
  | 'insufficient'
  | 'invalid'
  | 'stale'
  | 'unsupported'
  | 'permission_denied'
  | 'no_data';
export type HrvPlatform = 'web' | 'ios' | 'android' | null;

export interface HrvQualityReport {
  status: HrvValidationStatus;
  metric: HrvMetric | null;
  valueMs: number | null;
  sourceKind: HrvSourceKind;
  sourceName: string | null;
  sourceId: string | null;
  platform: HrvPlatform;
  deviceId: string | null;
  at: string | null;
  ageSec: number | null;
  validIntervals: number;
  totalIntervals: number;
  validRatio: number | null;
  rrAdvertised: boolean;
  rrPayloadTruncated: boolean;
  reasons: string[];
}

export interface BleHrvCapture {
  rrIntervalsMs: number[];
  totalIntervals: number;
  invalidIntervals: number;
  rrAdvertised: boolean;
  rrPayloadTruncated?: boolean;
  lastPacketAt: number | null;
  sourceName?: string | null;
  sourceId?: string | null;
  platform?: HrvPlatform;
  deviceId?: string | null;
  metric?: HrvMetric;
  valueMs?: number | null;
  nowMs?: number;
}

export interface NativeHrvSample {
  valueMs: number | null;
  metric: HrvMetric;
  at: string | null;
  sourceKind: 'apple_health' | 'health_connect';
  sourceName?: string | null;
  sourceId?: string | null;
  platform: 'ios' | 'android';
  nowMs?: number;
  maxAgeMs?: number;
}

export const HRV_MIN_RR_MS = 250;
export const HRV_MAX_RR_MS = 3000;
export const HRV_MIN_VALID_INTERVALS = 10;
export const HRV_MIN_VALID_RATIO = 0.8;
export const HRV_LIVE_MAX_AGE_MS = 30 * 1000;
export const HRV_HEALTH_MAX_AGE_MS = 36 * 60 * 60 * 1000;

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function ageInSeconds(at: string | null, nowMs: number): number | null {
  if (!at) return null;
  const timestamp = Date.parse(at);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (nowMs - timestamp) / 1000);
}

function baseReport(
  sourceKind: HrvSourceKind,
  platform: HrvPlatform,
  sourceName: string | null,
  sourceId: string | null,
  deviceId: string | null,
  metric: HrvMetric | null,
  valueMs: number | null,
  at: string | null,
  validIntervals: number,
  totalIntervals: number,
  validRatio: number | null,
  rrAdvertised: boolean,
  rrPayloadTruncated: boolean,
  ageSec: number | null,
  status: HrvValidationStatus,
  reasons: string[],
): HrvQualityReport {
  return {
    status,
    metric,
    valueMs: status === 'valid' ? valueMs : null,
    sourceKind,
    sourceName,
    sourceId,
    platform,
    deviceId,
    at,
    ageSec,
    validIntervals,
    totalIntervals,
    validRatio,
    rrAdvertised,
    rrPayloadTruncated,
    reasons,
  };
}

export function validateBleHrvCapture(capture: BleHrvCapture): HrvQualityReport {
  const nowMs = capture.nowMs ?? Date.now();
  const validIntervals = Array.isArray(capture.rrIntervalsMs)
    ? capture.rrIntervalsMs.filter((value) => finite(value) && value >= HRV_MIN_RR_MS && value <= HRV_MAX_RR_MS).length
    : 0;
  const totalIntervals = Math.max(0, Math.round(capture.totalIntervals || 0));
  const invalidIntervals = Math.max(0, Math.round(capture.invalidIntervals || 0));
  const observedIntervals = Math.max(totalIntervals, validIntervals + invalidIntervals);
  const validRatio = observedIntervals > 0 ? validIntervals / observedIntervals : null;
  const ageSec = capture.lastPacketAt == null ? null : Math.max(0, (nowMs - capture.lastPacketAt) / 1000);
  const packetAt = capture.lastPacketAt == null ? null : new Date(capture.lastPacketAt).toISOString();
  const reasons: string[] = [];

  if (!capture.rrAdvertised && observedIntervals === 0) {
    reasons.push('rr_not_advertised');
    return baseReport(
      'ble', capture.platform ?? null, capture.sourceName ?? null, capture.sourceId ?? null,
            capture.deviceId ?? null, null, null, packetAt, validIntervals, observedIntervals,
      validRatio, false, false, ageSec, 'no_data', reasons,
    );
  }
  if (validIntervals < HRV_MIN_VALID_INTERVALS) reasons.push('rr_insufficient');
  if (validRatio != null && validRatio < HRV_MIN_VALID_RATIO) reasons.push('rr_quality_below_threshold');
  if (capture.rrPayloadTruncated) reasons.push('rr_payload_truncated');
  if (ageSec != null && ageSec * 1000 > HRV_LIVE_MAX_AGE_MS) reasons.push('last_packet_stale');
  if (capture.valueMs != null && (!finite(capture.valueMs) || capture.valueMs <= 0)) reasons.push('hrv_value_invalid');
  if (validIntervals >= HRV_MIN_VALID_INTERVALS && !finite(capture.valueMs)) reasons.push('hrv_metric_unavailable');

  let status: HrvValidationStatus = 'valid';
  if (reasons.includes('last_packet_stale')) status = 'stale';
  else if (reasons.includes('rr_quality_below_threshold') || reasons.includes('rr_payload_truncated') || reasons.includes('hrv_value_invalid') || reasons.includes('hrv_metric_unavailable')) status = 'invalid';
  else if (reasons.length > 0) status = 'insufficient';

  return baseReport(
    'ble', capture.platform ?? null, capture.sourceName ?? null, capture.sourceId ?? null,
    capture.deviceId ?? null, capture.metric ?? 'rmssd', capture.valueMs ?? null, packetAt,
    validIntervals, observedIntervals, validRatio, capture.rrAdvertised,
    capture.rrPayloadTruncated ?? false, ageSec, status, reasons,
  );
}

export function validateNativeHrvSample(sample: NativeHrvSample): HrvQualityReport {
  const nowMs = sample.nowMs ?? Date.now();
  const ageSec = ageInSeconds(sample.at, nowMs);
  const reasons: string[] = [];

  if (!finite(sample.valueMs) || sample.valueMs <= 0) reasons.push('hrv_value_invalid');
  if (ageSec == null) reasons.push('timestamp_invalid');
  if (ageSec != null && ageSec * 1000 > (sample.maxAgeMs ?? HRV_HEALTH_MAX_AGE_MS)) reasons.push('sample_stale');

  let status: HrvValidationStatus = 'valid';
  if (reasons.includes('sample_stale')) status = 'stale';
  else if (reasons.length > 0) status = 'invalid';

  return baseReport(
    sample.sourceKind,
    sample.platform,
    sample.sourceName ?? null,
    sample.sourceId ?? null,
    null,
    sample.metric,
    sample.valueMs,
    sample.at,
    0,
    0,
    null,
    false,
    false,
    ageSec,
    status,
    reasons,
  );
}

export function noNativeHrvReport(
  sourceKind: 'apple_health' | 'health_connect',
  platform: 'ios' | 'android',
  status: Extract<HrvValidationStatus, 'no_data' | 'unsupported' | 'permission_denied'>,
  reason: string,
  at: string | null = null,
): HrvQualityReport {
  const ageSec = ageInSeconds(at, Date.now());
  return baseReport(
    sourceKind,
    platform,
    platform === 'ios' ? 'Apple Health' : 'Health Connect',
    null,
    null,
    platform === 'ios' ? 'sdnn' : 'rmssd',
    null,
    at,
    0,
    0,
    null,
    false,
    false,
    ageSec,
    status,
    [reason],
  );
}

export function hrvValidationLabel(status: HrvValidationStatus): string {
  switch (status) {
    case 'valid': return 'HRV válida';
    case 'insufficient': return 'RR insuficientes';
    case 'invalid': return 'HRV rejeitada';
    case 'stale': return 'HRV antiga';
    case 'permission_denied': return 'Permissão de HRV negada';
    case 'unsupported': return 'HRV não suportada';
    case 'no_data': return 'Sem HRV disponível';
  }
}

export function hrvValidationReason(status: HrvValidationStatus, reasons: string[] = []): string {
  if (reasons.includes('rr_not_advertised')) return 'O dispositivo transmite BPM, mas não envia intervalos RR.';
  if (reasons.includes('rr_insufficient')) return 'A sessão ainda não tem intervalos RR suficientes.';
  if (reasons.includes('rr_quality_below_threshold')) return 'Muitos intervalos RR foram rejeitados por qualidade.';
  if (reasons.includes('rr_payload_truncated')) return 'O pacote BLE de RR chegou truncado.';
  if (reasons.includes('last_packet_stale') || reasons.includes('sample_stale')) return 'A última medição está antiga para ser usada como atual.';
  if (reasons.includes('timestamp_invalid')) return 'A amostra não possui timestamp válido.';
  if (reasons.includes('hrv_value_invalid')) return 'O valor recebido está fora do formato esperado.';
  if (reasons.includes('hrv_metric_unavailable')) return 'Os intervalos foram recebidos, mas a métrica não pôde ser calculada com segurança.';
  if (status === 'permission_denied') return 'Autorize a leitura de HRV nas configurações de saúde.';
  if (status === 'unsupported') return 'A fonte ou o dispositivo não oferece este tipo de HRV.';
  if (status === 'no_data') return 'Nenhuma amostra de HRV foi sincronizada ainda.';
  return 'Amostra de HRV validada.';
}
