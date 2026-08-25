import { describe, expect, it } from 'vitest';
import type { TrainingLog } from '../types';
import { buildReadinessTrend } from './readinessTrend';

function log(date: string, values: Partial<TrainingLog> = {}): TrainingLog {
  return {
    id: date,
    user_id: 'user-1',
    date,
    title: 'WOD',
    category: 'wod',
    created_at: `${date}T12:00:00Z`,
    ...values,
  };
}

describe('buildReadinessTrend', () => {
  it('monta pontos de HRV e prontidão a partir do histórico individual', () => {
    const trend = buildReadinessTrend(
      [log('2026-08-25', { feeling: 'bem', rpe: 5, sleep_hours: 8 })],
      [
        { source: 'health', hrv_metric: 'rmssd', hrv_rmssd_ms: 40, hrv_at: '2026-08-25T08:00:00Z' },
        { source: 'health', hrv_metric: 'rmssd', hrv_rmssd_ms: 60, hrv_at: '2026-08-24T08:00:00Z' },
        { source: 'health', hrv_metric: 'rmssd', hrv_rmssd_ms: 62, hrv_at: '2026-08-23T08:00:00Z' },
        { source: 'health', hrv_metric: 'rmssd', hrv_rmssd_ms: 58, hrv_at: '2026-08-22T08:00:00Z' },
      ],
      28,
      new Date(2026, 7, 25, 12),
    );
    const current = trend.points[trend.points.length - 1];

    expect(trend.points).toHaveLength(28);
    expect(trend.hrvPointCount).toBe(4);
    expect(current.hrvMs).toBe(40);
    expect(current.hrvBaselineMs).toBe(60);
    expect(current.hrvDeltaPct).toBeCloseTo(-33.333, 2);
    expect(current.readinessStatus).toBe('control');
    expect(current.readinessLevel).toBe(1);
    expect(current.readinessLabel).toBe('Controle');
  });

  it('mantém lacunas para prontidão sem histórico e não usa BLE como baseline de repouso', () => {
    const trend = buildReadinessTrend(
      [],
      [
        { source: 'ble', hrv_metric: 'rmssd', hrv_rmssd_ms: 40, ended_at: '2026-08-25T12:00:00Z' },
        { source: 'health', hrv_metric: 'rmssd', hrv_rmssd_ms: 60, hrv_at: '2026-08-24T08:00:00Z' },
      ],
      2,
      new Date(2026, 7, 25, 12),
    );

    expect(trend.hrvPointCount).toBe(1);
    expect(trend.points[1].hrvMs).toBeNull();
    expect(trend.points[1].readinessLevel).toBeNull();
    expect(trend.points[1].readinessLabel).toBe('Sem histórico');
  });
});
