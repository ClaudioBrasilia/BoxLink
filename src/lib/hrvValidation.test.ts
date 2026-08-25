import { describe, expect, it } from 'vitest';
import {
  HRV_HEALTH_MAX_AGE_MS,
  validateBleHrvCapture,
  validateNativeHrvSample,
  noNativeHrvReport,
} from './hrvValidation';

const validRr = Array.from({ length: 10 }, () => 800);
const now = Date.parse('2026-08-25T12:00:00.000Z');

function ble(overrides: Partial<Parameters<typeof validateBleHrvCapture>[0]> = {}) {
  return validateBleHrvCapture({
    rrIntervalsMs: validRr,
    totalIntervals: 10,
    invalidIntervals: 0,
    rrAdvertised: true,
    lastPacketAt: now,
    valueMs: 42,
    nowMs: now,
    ...overrides,
  });
}

describe('validateBleHrvCapture', () => {
  it('aceita uma captura completa com cobertura válida', () => {
    const result = ble();

    expect(result.status).toBe('valid');
    expect(result.metric).toBe('rmssd');
    expect(result.validIntervals).toBe(10);
    expect(result.totalIntervals).toBe(10);
    expect(result.validRatio).toBe(1);
    expect(result.rrAdvertised).toBe(true);
  });

  it('diferencia BPM sem RR de RR insuficiente', () => {
    expect(ble({ rrIntervalsMs: [], totalIntervals: 0, rrAdvertised: false, valueMs: null }).status).toBe('no_data');
    expect(ble({ rrIntervalsMs: [800, 810], totalIntervals: 2, valueMs: null }).status).toBe('insufficient');
  });

  it('rejeita captura com cobertura de RR abaixo de 80%', () => {
    const result = ble({
      rrIntervalsMs: validRr,
      totalIntervals: 13,
      invalidIntervals: 3,
    });

    expect(result.status).toBe('invalid');
    expect(result.validRatio).toBeCloseTo(10 / 13);
    expect(result.reasons).toContain('rr_quality_below_threshold');
  });

  it('marca payload truncado como inválido e conserva o motivo', () => {
    const result = ble({ rrPayloadTruncated: true });

    expect(result.status).toBe('invalid');
    expect(result.reasons).toContain('rr_payload_truncated');
  });

  it('rejeita RR suficiente quando a métrica não pôde ser calculada', () => {
    const result = ble({ valueMs: null });

    expect(result.status).toBe('invalid');
    expect(result.reasons).toContain('hrv_metric_unavailable');
  });

  it('não considera uma captura BLE antiga como HRV atual', () => {
    const result = ble({ lastPacketAt: now - 31_000 });

    expect(result.status).toBe('stale');
    expect(result.reasons).toContain('last_packet_stale');
  });
});

describe('validateNativeHrvSample', () => {
  it('preserva SDNN para Apple Health e aceita timestamp recente', () => {
    const result = validateNativeHrvSample({
      valueMs: 38,
      metric: 'sdnn',
      at: '2026-08-25T06:00:00.000Z',
      sourceKind: 'apple_health',
      sourceName: 'Apple Health',
      platform: 'ios',
      nowMs: now,
    });

    expect(result.status).toBe('valid');
    expect(result.metric).toBe('sdnn');
    expect(result.sourceKind).toBe('apple_health');
  });

  it('preserva RMSSD para Health Connect', () => {
    const result = validateNativeHrvSample({
      valueMs: 44,
      metric: 'rmssd',
      at: '2026-08-25T06:00:00.000Z',
      sourceKind: 'health_connect',
      sourceName: 'Health Connect',
      platform: 'android',
      nowMs: now,
    });

    expect(result.status).toBe('valid');
    expect(result.metric).toBe('rmssd');
    expect(result.platform).toBe('android');
  });

  it('marca valor nativo inválido e amostra stale separadamente', () => {
    const invalid = validateNativeHrvSample({
      valueMs: 0,
      metric: 'rmssd',
      at: '2026-08-25T06:00:00.000Z',
      sourceKind: 'health_connect',
      platform: 'android',
      nowMs: now,
    });
    const stale = validateNativeHrvSample({
      valueMs: 40,
      metric: 'rmssd',
      at: new Date(now - HRV_HEALTH_MAX_AGE_MS - 1).toISOString(),
      sourceKind: 'health_connect',
      platform: 'android',
      nowMs: now,
    });

    expect(invalid.status).toBe('invalid');
    expect(invalid.reasons).toContain('hrv_value_invalid');
    expect(stale.status).toBe('stale');
    expect(stale.reasons).toContain('sample_stale');
  });
});

describe('noNativeHrvReport', () => {
  it('mantém a diferença entre permissão negada e ausência de suporte', () => {
    const denied = noNativeHrvReport('health_connect', 'android', 'permission_denied', 'hrv_permission_denied');
    const unsupported = noNativeHrvReport('apple_health', 'ios', 'unsupported', 'health_unavailable');

    expect(denied.status).toBe('permission_denied');
    expect(denied.metric).toBe('rmssd');
    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.metric).toBe('sdnn');
  });
});
