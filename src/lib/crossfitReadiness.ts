import type { TrainingLog, TrainingLogCategory } from '../types';

export type CrossFitWorkoutFamily = 'metcon' | 'interval' | 'strength' | 'skill' | 'mobility' | 'mixed' | 'unknown';

export interface WorkoutDescriptor {
  category?: TrainingLogCategory | string | null;
  wodType?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface FamilyCardioSignal {
  family: CrossFitWorkoutFamily;
  latestLoad: number | null;
  baselineLoad: number | null;
  deltaPct: number | null;
  baselineCount: number;
  confidence: 'high' | 'medium' | 'low';
}

const normalize = (value: string | null | undefined): string =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const hasAny = (text: string, terms: string[]): boolean => terms.some(term => text.includes(term));

export function classifyWorkoutFamily(descriptor: WorkoutDescriptor): CrossFitWorkoutFamily {
  const category = normalize(descriptor.category);
  const wodType = normalize(descriptor.wodType);
  const text = normalize([descriptor.title, descriptor.description].filter(Boolean).join(' '));

  if (hasAny(text, ['mobilidade', 'mobility', 'recovery', 'alongamento', 'stretch'])) return 'mobility';
  if (category === 'forca' || hasAny(text, ['forca', 'strength', '1rm', '3rm', '5x5', 'agachamento', 'squat', 'deadlift', 'levantamento terra', 'snatch', 'clean and jerk', 'clean & jerk', 'press'])) return 'strength';
  if (hasAny(text, ['skill', 'tecnica', 'technique'])) return 'skill';
  if (wodType === 'emom' || wodType === 'tabata' || hasAny(text, ['emom', 'tabata', 'interval', 'sprint'])) return 'interval';
  if (category === 'wod' || hasAny(text, ['amrap', 'for time', 'metcon', 'benchmark'])) return 'metcon';
  if (category === 'desafio') return 'mixed';
  return 'unknown';
}

export function calculateFamilyCardioSignal(logs: Pick<TrainingLog, 'id' | 'date' | 'category' | 'wod_type' | 'title' | 'description' | 'effort_index'>[]): FamilyCardioSignal | null {
  const measured = logs
    .filter(log => Number.isFinite(log.effort_index) && Number(log.effort_index) > 0)
    .map(log => ({ log, family: classifyWorkoutFamily(log), load: Number(log.effort_index) }))
    .sort((a, b) => b.log.date.localeCompare(a.log.date));
  const latest = measured[0];
  if (!latest) return null;

  const sameFamily = measured.filter(item => item.family === latest.family);
  const baseline = sameFamily.slice(1, 4).map(item => item.load);
  if (baseline.length < 3) {
    return { family: latest.family, latestLoad: latest.load, baselineLoad: null, deltaPct: null, baselineCount: baseline.length, confidence: 'medium' };
  }

  const baselineLoad = baseline.reduce((sum, load) => sum + load, 0) / baseline.length;
  return {
    family: latest.family,
    latestLoad: latest.load,
    baselineLoad,
    deltaPct: baselineLoad > 0 ? ((latest.load - baselineLoad) / baselineLoad) * 100 : null,
    baselineCount: baseline.length,
    confidence: 'high',
  };
}
