// src/lib/hrSessionStats.ts
// ============================================================================
// Estatísticas da sessão de FC e montagem do registro do histórico.
// ----------------------------------------------------------------------------
// Este cálculo vivia dentro do HeartRateSummary, o que amarrava a GRAVAÇÃO do
// treino à tela de resumo continuar montada: se o atleta fechasse o app ao
// terminar, a sessão se perdia sem deixar rastro. Aqui é código puro, então o
// widget consegue gravar assim que a sessão encerra e a tela segue apenas
// exibindo. Os números são os mesmos de antes — só mudou onde moram.
// ============================================================================
import {
  ageFromBirthDate, estimateCalories, maxHrPercent, hasCalorieData, type Biometrics,
} from './heartRate';
import { calculateHrvMetrics, type HrvMetric } from './hrv';
import type { HrvQualityReport } from './hrvValidation';
import type { HrSample } from '../hooks/useHeartRateSession';
import type { NewHrSession } from './heartRateSessions';

/** Peso de cada zona no índice de esforço (carga). */
export const HR_ZONE_WEIGHTS = [1, 2, 3, 4, 5];

/** BPM mínimo de cada zona — fonte única para o cálculo e para a UI. */
export const HR_ZONE_MINIMUMS = [0, 100, 120, 140, 160];

export function hrZoneIndex(bpm: number): number {
  let idx = 0;
  for (let i = 0; i < HR_ZONE_MINIMUMS.length; i++) if (bpm >= HR_ZONE_MINIMUMS[i]) idx = i;
  return idx;
}

export interface HrSessionStatsInput {
  samples: HrSample[];
  bio?: Biometrics;
  rrIntervalsMs?: number[];
  hrvMsOverride?: number | null;
  hrvMetricOverride?: HrvMetric | null;
  hrvAtOverride?: string | null;
  hrvQuality?: HrvQualityReport | null;
}

export interface HrSessionStats {
  avg: number;
  max: number;
  min: number;
  durationSec: number;
  zoneSecs: number[];
  totalZoneSec: number;
  dominant: number;
  effort: number;
  estCalories: number | null;
  avgPctMax: number | null;
  hrvMs: number | null;
  hrvMetric: HrvMetric | null;
  hrvAt: string | null;
  hrvValidIntervals: number;
  hrvQuality: ReturnType<typeof calculateHrvMetrics>['quality'];
  hrvValidation: HrvQualityReport | null;
}

export function computeHrSessionStats({
  samples, bio = {}, rrIntervalsMs = [],
  hrvMsOverride, hrvMetricOverride, hrvAtOverride, hrvQuality,
}: HrSessionStatsInput): HrSessionStats {
  const bpms = samples.map((s) => s.bpm);
  const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  const max = Math.max(...bpms);
  const min = Math.min(...bpms);
  const durationSec = samples[samples.length - 1]?.t ?? 0;

  // Tempo por zona (cada amostra ≈ intervalo entre amostras)
  const stepSec = samples.length > 1 ? Math.max(1, Math.round(durationSec / (samples.length - 1))) : 2;
  const zoneSecs = new Array(HR_ZONE_MINIMUMS.length).fill(0);
  for (const s of samples) zoneSecs[hrZoneIndex(s.bpm)] += stepSec;
  const totalZoneSec = zoneSecs.reduce((a, b) => a + b, 0) || 1;
  const dominant = zoneSecs.indexOf(Math.max(...zoneSecs));

  // Índice de esforço (carga): minutos em cada zona × peso da zona.
  const effort = Math.round(
    zoneSecs.reduce((acc, sec, i) => acc + (sec / 60) * HR_ZONE_WEIGHTS[i], 0)
  );

  // Métricas dependentes da biometria (estimativa)
  const age = ageFromBirthDate(bio.birthDate);
  const estCalories = hasCalorieData(bio) ? estimateCalories(avg, durationSec / 60, bio) : null;
  const avgPctMax = maxHrPercent(avg, age);
  const calculatedHrv = calculateHrvMetrics(rrIntervalsMs);
  const hrvMetric: HrvMetric | null = hrvMetricOverride ?? (calculatedHrv.rmssdMs != null ? 'rmssd' : null);
  const hasHrvOverride = hrvMsOverride !== undefined;
  const rawHrvMs = hasHrvOverride
    ? hrvMsOverride
    : hrvMetric === 'sdnn' ? calculatedHrv.sdnnMs : calculatedHrv.rmssdMs;
  const hrvMs = hrvQuality && hrvQuality.status !== 'valid' ? null : rawHrvMs;

  return {
    avg, max, min, durationSec, zoneSecs, totalZoneSec, dominant, effort, estCalories, avgPctMax,
    hrvMs: hrvMs ?? null,
    hrvMetric,
    hrvAt: hrvAtOverride ?? hrvQuality?.at ?? null,
    hrvValidIntervals: calculatedHrv.validIntervals,
    hrvQuality: calculatedHrv.quality,
    hrvValidation: hrvQuality ?? null,
  };
}

export interface HrSessionPayloadInput extends HrSessionStatsInput {
  userId: string;
  startedAt: number | null;
  endedAtMs?: number;
  deviceName?: string | null;
  source?: 'ble' | 'health' | null;
  /** Calorias reais do relógio; ausente cai para a estimativa. */
  deviceCalories?: number | null;
  deviceSteps?: number | null;
  caloriesSourceOverride?: 'device' | 'estimate' | null;
}

/**
 * Arredonda para coluna `integer` do Postgres.
 *
 * ⚠️ Isto não é firula: o histórico ficou 26 DIAS sem gravar nada porque
 * hrvQuality.ageSec chega em segundos fracionários (ex.: 0.477) e a coluna
 * hrv_age_sec é integer — o Postgres respondia
 * `invalid input syntax for type integer: "0.477"` e o INSERT inteiro caía com
 * 400. Vale para todo campo inteiro: calorias e passos vêm do app de saúde e
 * também podem chegar fracionários.
 */
function toInt(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Monta o registro exatamente como o histórico espera. */
export function buildHrSessionPayload(input: HrSessionPayloadInput): NewHrSession {
  const stats = computeHrSessionStats(input);
  const {
    userId, startedAt, endedAtMs = Date.now(), deviceName, source,
    deviceCalories, deviceSteps, caloriesSourceOverride, hrvQuality, rrIntervalsMs = [],
  } = input;

  // Calorias: prioriza o valor real do relógio; cai para a estimativa.
  const calories = deviceCalories ?? stats.estCalories;
  const caloriesFromDevice =
    caloriesSourceOverride != null ? caloriesSourceOverride === 'device' : deviceCalories != null;

  return {
    user_id: userId,
    started_at: startedAt ? new Date(startedAt).toISOString() : null,
    ended_at: new Date(endedAtMs).toISOString(),
    duration_sec: toInt(stats.durationSec),
    avg_bpm: toInt(stats.avg),
    max_bpm: toInt(stats.max),
    min_bpm: toInt(stats.min),
    effort: toInt(stats.effort),
    calories: toInt(calories),
    calories_source: calories == null ? null : caloriesFromDevice ? 'device' : 'estimate',
    steps: toInt(deviceSteps),
    zone_secs: stats.zoneSecs,
    dominant_zone: toInt(stats.dominant),
    samples: input.samples,
    device_name: deviceName ?? null,
    source: source ?? null,
    rr_intervals_ms: rrIntervalsMs,
    hrv_rmssd_ms: stats.hrvMetric === 'rmssd' ? stats.hrvMs : null,
    hrv_sdnn_ms: stats.hrvMetric === 'sdnn' ? stats.hrvMs : null,
    hrv_metric: stats.hrvMetric,
    hrv_at: stats.hrvAt,
    hrv_validation_status: hrvQuality?.status ?? (stats.hrvMs != null ? 'valid' : 'no_data'),
    hrv_validation_reason: hrvQuality?.reasons?.join(',') ?? null,
    hrv_valid_intervals: toInt(hrvQuality?.validIntervals ?? stats.hrvValidIntervals),
    hrv_total_intervals: toInt(hrvQuality?.totalIntervals),
    hrv_valid_ratio: hrvQuality?.validRatio ?? null,
    hrv_age_sec: toInt(hrvQuality?.ageSec),
    hrv_source_kind: hrvQuality?.sourceKind
      ?? (source === 'ble' ? 'ble' : source === 'health' ? (deviceName === 'Apple Health' ? 'apple_health' : 'health_connect') : null),
    hrv_source_name: hrvQuality?.sourceName ?? deviceName ?? null,
    hrv_source_id: hrvQuality?.sourceId ?? null,
    hrv_platform: hrvQuality?.platform ?? null,
    hrv_device_id: hrvQuality?.deviceId ?? null,
  };
}
