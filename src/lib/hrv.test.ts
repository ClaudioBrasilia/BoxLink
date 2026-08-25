import { describe, expect, it } from 'vitest';
import {
  calculateHrvMetrics,
  calculateHrvReadinessSignal,
  hrvRecordsFromHealthSessions,
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
    expect(result.rrPresent).toBe(false);
    expect(result.rrTotal).toBe(0);
  });

  it('conta RR inválidos sem expor os valores rejeitados', () => {
    const valid = rrRaw(800);
    const invalid = rrRaw(100);
    const result = parseStandardHeartRateMeasurement(dv([
      0x10, 60,
      valid & 0xff, valid >> 8,
      invalid & 0xff, invalid >> 8,
    ]));

    expect(result.rrIntervalsMs).toHaveLength(1);
    expect(result.rrTotal).toBe(2);
    expect(result.rrInvalid).toBe(1);
    expect(result.rrPayloadTruncated).toBe(false);
  });

  it('marca payload RR com byte final incompleto como truncado', () => {
    const rr = rrRaw(800);
    const result = parseStandardHeartRateMeasurement(dv([0x10, 60, rr & 0xff, rr >> 8, 0xaa]));

    expect(result.rrTotal).toBe(1);
    expect(result.rrInvalid).toBe(1);
    expect(result.rrPayloadTruncated).toBe(true);
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

describe('hrvRecordsFromHealthSessions', () => {
  it('exclui HRV rejeitada e mantém sessões legadas sem status', () => {
    const result = hrvRecordsFromHealthSessions([
      {
        source: 'health',
        hrv_metric: 'rmssd',
        hrv_rmssd_ms: 44,
        hrv_at: '2026-08-25T06:00:00Z',
        hrv_validation_status: 'valid',
      },
      {
        source: 'health',
        hrv_metric: 'rmssd',
        hrv_rmssd_ms: 99,
        hrv_at: '2026-08-24T06:00:00Z',
        hrv_validation_status: 'stale',
      },
      {
        source: 'health',
        hrv_metric: 'sdnn',
        hrv_sdnn_ms: 35,
        hrv_at: '2026-08-23T06:00:00Z',
      },
      {
        source: 'ble',
        hrv_metric: 'rmssd',
        hrv_rmssd_ms: 70,
        hrv_at: '2026-08-22T06:00:00Z',
        hrv_validation_status: 'valid',
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((record) => record.valueMs)).toEqual([44, 35]);
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
