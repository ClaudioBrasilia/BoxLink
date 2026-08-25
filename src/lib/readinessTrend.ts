import type { TrainingLog } from '../types';
import { calculateHrvReadinessSignal, hrvRecordsFromHealthSessions, type HealthHrvSessionLike, type HrvReadinessRecord } from './hrv';
import { calculateReadiness, type ReadinessResult, type ReadinessStatus } from './readiness';

export interface ReadinessTrendPoint {
  date: string;
  shortDate: string;
  hrvMs: number | null;
  hrvBaselineMs: number | null;
  hrvDeltaPct: number | null;
  hrvMetric: 'rmssd' | 'sdnn' | null;
  readinessLevel: number | null;
  readinessStatus: ReadinessStatus;
  readinessLabel: string;
  readinessConfidence: ReadinessResult['confidence'];
  readinessHasHistory: boolean;
  rpe: number | null;
  sleepHours: number | null;
}

export interface ReadinessTrend {
  points: ReadinessTrendPoint[];
  hrvPointCount: number;
  readinessPointCount: number;
  latestHrvMs: number | null;
  latestHrvMetric: 'rmssd' | 'sdnn' | null;
}

const DAY_MS = 86400000;
const WINDOW_DAYS = 28;
const APP_TIME_ZONE = 'America/Sao_Paulo';

const STATUS_LEVEL: Record<ReadinessStatus, number> = {
  recovery: 0,
  control: 1,
  ready: 2,
};

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  recovery: 'Recuperação',
  control: 'Controle',
  ready: 'Pronto',
};

function dateFromKey(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE });
}

function timestampDateKey(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? dateKey(date) : null;
}

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function dayDifference(from: string, to: string): number {
  return Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / DAY_MS);
}

function latestFeedbackForDay(logs: TrainingLog[], date: string): TrainingLog | null {
  const dayLogs = logs
    .filter((log) => log.date === date && (log.feeling != null || finite(log.rpe) != null || (finite(log.sleep_hours) != null && log.sleep_hours! > 0)))
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  return dayLogs[dayLogs.length - 1] || null;
}

function consecutiveDays(logs: TrainingLog[], date: string, predicate: (log: TrainingLog) => boolean): number {
  let count = 0;
  for (let offset = 0; offset < WINDOW_DAYS; offset++) {
    const day = new Date(dateFromKey(date).getTime() - offset * DAY_MS);
    const latest = latestFeedbackForDay(logs, dateKey(day));
    if (!latest || !predicate(latest)) break;
    count++;
  }
  return count;
}

function hrvRecordsUntilDate(records: HrvReadinessRecord[], date: string): HrvReadinessRecord[] {
  return records.filter((record) => {
    if (!record.at) return true;
    const recordDate = timestampDateKey(record.at);
    return recordDate == null || recordDate <= date;
  });
}

function latestHrvForDate(records: HrvReadinessRecord[], date: string): HrvReadinessRecord | null {
  const sameDay = records.filter((record) => record.at != null && timestampDateKey(record.at) === date);
  return sameDay.sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime()).at(-1) ?? null;
}

function hrvRecords(sessions: HealthHrvSessionLike[]): HrvReadinessRecord[] {
  return hrvRecordsFromHealthSessions(sessions);
}

export function buildReadinessTrend(
  logs: TrainingLog[],
  healthSessions: HealthHrvSessionLike[],
  days = WINDOW_DAYS,
  today = new Date(),
): ReadinessTrend {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const records = hrvRecords(healthSessions);
  const points: ReadinessTrendPoint[] = [];
  const todayKey = dateKey(today);

  for (let offset = safeDays - 1; offset >= 0; offset--) {
    const date = dateKey(new Date(dateFromKey(todayKey).getTime() - offset * DAY_MS));
    const latest = latestFeedbackForDay(logs, date);
    const windowStart = new Date(dateFromKey(date).getTime() - WINDOW_DAYS * DAY_MS);
    const feedbackLogs = logs.filter((log) => {
      if (!log.date) return false;
      const timestamp = dateFromKey(log.date).getTime();
      return timestamp >= windowStart.getTime() && timestamp <= dateFromKey(date).getTime() + DAY_MS;
    });
    const rpeValues = feedbackLogs.map((log) => finite(log.rpe)).filter((value): value is number => value != null);
    const sleepValues = feedbackLogs
      .map((log) => finite(log.sleep_hours))
      .filter((value): value is number => value != null && value > 0);
    const dayHrv = latestHrvForDate(records, date);
    const hrvSignal = dayHrv
      ? calculateHrvReadinessSignal(hrvRecordsUntilDate(records, date).filter((record) => record.metric === dayHrv.metric))
      : { latestMs: null, baselineMs: null, deltaPct: null, baselineCount: 0, metric: null, latestAt: null, confidence: 'low' as const };
    const latestRpe = finite(latest?.rpe);
    const latestSleep = finite(latest?.sleep_hours);
    const readiness = calculateReadiness({
      latestFeeling: latest?.feeling,
      latestRpe,
      averageRpe: rpeValues.length ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length : null,
      latestSleepHours: latestSleep,
      averageSleepHours: sleepValues.length ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length : null,
      consecutiveTired: consecutiveDays(logs, date, (log) => log.feeling === 'cansado'),
      consecutiveHighRpe: consecutiveDays(logs, date, (log) => finite(log.rpe) != null && log.rpe! >= 8),
      hrvDeltaPct: hrvSignal.deltaPct,
      hrvBaselineCount: hrvSignal.baselineCount,
      hrvConfidence: hrvSignal.confidence,
      rpeSampleCount: rpeValues.length,
      sleepSampleCount: sleepValues.length,
      latestDataDate: date,
    });
    const hasAnyData = latest != null || hrvSignal.latestMs != null;
    const hasReadinessLine = hasAnyData && readiness.hasEnoughHistory;

    points.push({
      date,
      shortDate: date.slice(5).replace('-', '/'),
      hrvMs: dayHrv?.valueMs ?? null,
      hrvBaselineMs: hrvSignal.baselineMs,
      hrvDeltaPct: dayHrv ? hrvSignal.deltaPct : null,
      hrvMetric: dayHrv?.metric ?? null,
      readinessLevel: hasReadinessLine ? STATUS_LEVEL[readiness.status] : null,
      readinessStatus: readiness.status,
      readinessLabel: readiness.hasEnoughHistory ? STATUS_LABEL[readiness.status] : 'Sem histórico',
      readinessConfidence: readiness.confidence,
      readinessHasHistory: readiness.hasEnoughHistory,
      rpe: latestRpe,
      sleepHours: latestSleep,
    });
  }

  const hrvPoints = points.filter((point) => point.hrvMs != null);
  const latestHrv = hrvPoints[hrvPoints.length - 1];
  return {
    points,
    hrvPointCount: hrvPoints.length,
    readinessPointCount: points.filter((point) => point.readinessLevel != null).length,
    latestHrvMs: latestHrv?.hrvMs ?? null,
    latestHrvMetric: latestHrv?.hrvMetric ?? null,
  };
}

export function readinessLevelLabel(level: number): string {
  if (level <= 0) return 'Recuperação';
  if (level >= 2) return 'Pronto';
  return 'Controle';
}
