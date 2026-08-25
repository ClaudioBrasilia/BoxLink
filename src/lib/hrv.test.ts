import { describe, expect, it } from 'vitest';
import {
  calculateHrvMetrics,
  calculateHrvReadinessSignal,
  parseStandardHeartRateMeasurement,
} from './hrv';

function dv(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

function rrRaw(milliseconds: number): number {
  return Math.round((milliseconds * 1024) / 1000);
}

describe('parseStandardHeartRateMeasurement', () => {
  it('lê BPM uint8 e intervalos RR em 1/1024 segundo', () => {
    const rr = rrRaw(1000);
    const result = parseStandardHeartRateMeasurement(dv([0x10, 60, rr & 0xff, rr >> 8]));
    expect(result.bpm).toBe(60);
    expect(result.rrIntervalsMs[0]).toBeCloseTo(1000, 0);
  });

  it('respeita Energy Expended antes dos intervalos RR', () => {
    const rr = rrRaw(800);
    const result = parseStandardHeartRateMeasurement(dv([0x18, 75, 0x34, 0x12, rr & 0xff, rr >> 8]));
    expect(result.bpm).toBe(75);
    expect(result.rrIntervalsMs[0]).toBeCloseTo(800, 0);
  });

  it('lê BPM uint16 e múltiplos RR', () => {
    const rr1 = rrRaw(900);
    const rr2 = rrRaw(950);
    const result = parseStandardHeartRateMeasurement(dv([
      0x11, 0x5a, 0x00,
      rr1 & 0xff, rr1 >> 8,
      rr2 & 0xff, rr2 >> 8,
    ]));
    expect(result.bpm).toBe(90);
    expect(result.rrIntervalsMs).toHaveLength(2);
    expect(result.rrIntervalsMs[1]).toBeCloseTo(950, 0);
  });

  it('não interpreta bytes extras como RR quando a flag RR está ausente', () => {
    const result = parseStandardHeartRateMeasurement(dv([0x00, 60, 0x20, 0x03]));
    expect(result.bpm).toBe(60);
    expect(result.rrIntervalsMs).toEqual([]);
  });
});

describe('calculateHrvMetrics', () => {
  it('calcula RMSSD e SDNN para intervalos válidos', () => {
    const result = calculateHrvMetrics([1000, 1020, 980, 1010, 990, 1005, 995, 1015, 985, 1000]);
    expect(result.quality).toBe('good');
    expect(result.validIntervals).toBe(10);
    expect(result.rmssdMs).not.toBeNull();
    expect(result.sdnnMs).not.toBeNull();
  });

  it('não fabrica HRV com menos de dez intervalos', () => {
    const result = calculateHrvMetrics([1000, 1005, 995]);
    expect(result.rmssdMs).toBeNull();
    expect(result.sdnnMs).toBeNull();
    expect(result.quality).toBe('insufficient');
  });

  it('descarta intervalos fisiologicamente impossíveis', () => {
    const result = calculateHrvMetrics([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 100, 5000]);
    expect(result.validIntervals).toBe(10);
    expect(result.totalIntervals).toBe(12);
  });
});

describe('calculateHrvReadinessSignal', () => {
  it('compara o valor atual com três medições anteriores da mesma métrica', () => {
    const result = calculateHrvReadinessSignal([
      { valueMs: 40, metric: 'rmssd', at: '2026-08-25T08:00:00Z' },
      { valueMs: 60, metric: 'rmssd', at: '2026-08-24T08:00:00Z' },
      { valueMs: 62, metric: 'rmssd', at: '2026-08-23T08:00:00Z' },
      { valueMs: 58, metric: 'rmssd', at: '2026-08-22T08:00:00Z' },
      { valueMs: 75, metric: 'sdnn', at: '2026-08-24T07:00:00Z' },
    ]);
    expect(result.metric).toBe('rmssd');
    expect(result.baselineCount).toBe(3);
    expect(result.baselineMs).toBe(60);
    expect(result.deltaPct).toBeCloseTo(-33.333, 2);
    expect(result.confidence).toBe('high');
  });

  it('não mistura RMSSD com SDNN', () => {
    const result = calculateHrvReadinessSignal([
      { valueMs: 50, metric: 'rmssd', at: '2026-08-25T08:00:00Z' },
      { valueMs: 80, metric: 'sdnn', at: '2026-08-24T08:00:00Z' },
    ]);
    expect(result.metric).toBe('rmssd');
    expect(result.baselineCount).toBe(0);
    expect(result.baselineMs).toBeNull();
  });
});
