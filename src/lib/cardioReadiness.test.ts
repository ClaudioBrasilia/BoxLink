import { describe, expect, it } from 'vitest';
import { calculateCardioLoad, calculateCardioReadinessSignal } from './cardioReadiness';
import { calculateReadiness } from './readiness';

const session = (id: string, date: string, effort: number, durationSec = 900) => ({
  id,
  started_at: `${date}T10:00:00Z`,
  ended_at: `${date}T10:15:00Z`,
  duration_sec: durationSec,
  avg_bpm: 150,
  max_bpm: 180,
  min_bpm: 90,
  effort,
  calories: null,
  calories_source: null,
  steps: null,
  zone_secs: [60, 120, 180, 360, 180],
  dominant_zone: 3,
  samples: Array.from({ length: 90 }, (_, index) => ({ t: index * 10, bpm: 150 })),
  device_name: 'Polar',
  source: 'health' as const,
});

describe('cardio readiness', () => {
  it('usa o esforço armazenado para calcular a carga de uma sessão válida', () => {
    expect(calculateCardioLoad(session('1', '2026-08-18', 42))).toBe(42);
  });

  it('recompõe a carga pelas zonas quando o esforço armazenado está ausente', () => {
    const current = session('1', '2026-08-18', 0);
    expect(calculateCardioLoad(current)).toBe(53);
  });

  it('ignora uma sessão curta na carga cardiovascular', () => {
    expect(calculateCardioLoad(session('1', '2026-08-18', 42, 540))).toBeNull();
  });

  it('exige três sessões anteriores vinculadas para formar baseline', () => {
    const sessions = [
      session('latest', '2026-08-18', 52),
      session('old-1', '2026-08-17', 40),
      session('old-2', '2026-08-16', 40),
    ];
    const signal = calculateCardioReadinessSignal(sessions, new Set(sessions.map(item => item.id)));
    expect(signal.latestLoad).toBe(52);
    expect(signal.baselineCount).toBe(2);
    expect(signal.baselineLoad).toBeNull();
    expect(signal.confidence).toBe('medium');
  });

  it('calcula o desvio da sessão mais recente contra três sessões anteriores', () => {
    const sessions = [
      session('latest', '2026-08-18', 52),
      session('old-1', '2026-08-17', 40),
      session('old-2', '2026-08-16', 40),
      session('old-3', '2026-08-15', 40),
    ];
    const signal = calculateCardioReadinessSignal(sessions, new Set(sessions.map(item => item.id)));
    expect(signal.baselineLoad).toBe(40);
    expect(signal.deltaPct).toBe(30);
    expect(signal.confidence).toBe('high');
  });

  it('considera somente sessões explicitamente vinculadas', () => {
    const sessions = [
      session('latest', '2026-08-18', 80),
      session('old-1', '2026-08-17', 40),
      session('old-2', '2026-08-16', 40),
      session('old-3', '2026-08-15', 40),
    ];
    const signal = calculateCardioReadinessSignal(sessions, new Set(['old-1', 'old-2', 'old-3']));
    expect(signal.latestLoad).toBe(40);
    expect(signal.baselineCount).toBe(2);
  });

  it('gera controle com carga cardiovascular pelo menos 15% acima do baseline', () => {
    const result = calculateReadiness({
      latestRpe: 6,
      averageRpe: 6,
      cardioLoadDeltaPct: 20,
      cardioBaselineCount: 3,
      cardioConfidence: 'high',
    });
    expect(result.status).toBe('control');
    expect(result.reasons).toContain('cardio_load_elevated');
  });

  it('gera recuperação somente quando carga cardiovascular alta coincide com RPE alto', () => {
    const result = calculateReadiness({
      latestRpe: 8,
      averageRpe: 7,
      cardioLoadDeltaPct: 35,
      cardioBaselineCount: 3,
      cardioConfidence: 'high',
    });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('cardio_load_above_baseline');
  });

  it('não usa carga cardiovascular sem baseline confiável', () => {
    const result = calculateReadiness({
      latestRpe: 6,
      averageRpe: 6,
      cardioLoadDeltaPct: 50,
      cardioBaselineCount: 2,
      cardioConfidence: 'medium',
    });
    expect(result.status).toBe('ready');
    expect(result.reasons).toEqual(['no_alerts']);
  });
});
