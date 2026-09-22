// src/lib/hrSessionStats.test.ts
// ============================================================================
// O cálculo do resumo saiu de dentro do HeartRateSummary para cá, de modo que a
// gravação do treino deixasse de depender daquela tela continuar montada. Estes
// casos travam os números: o histórico precisa registrar exatamente o mesmo que
// registrava antes da extração.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  computeHrSessionStats, buildHrSessionPayload, hrZoneIndex,
  HR_ZONE_MINIMUMS, HR_ZONE_WEIGHTS,
} from './hrSessionStats';
import type { HrSample } from '../hooks/useHeartRateSession';

/** Série uniforme de 2 em 2 segundos, como o useHeartRateSession produz. */
function serie(bpms: number[]): HrSample[] {
  return bpms.map((bpm, i) => ({ t: i * 2, bpm }));
}

describe('hrZoneIndex', () => {
  it('classifica pelo piso de cada zona', () => {
    expect(hrZoneIndex(80)).toBe(0);   // repouso
    expect(hrZoneIndex(100)).toBe(1);  // aquecimento (limite exato)
    expect(hrZoneIndex(119)).toBe(1);
    expect(hrZoneIndex(120)).toBe(2);  // aeróbico
    expect(hrZoneIndex(140)).toBe(3);  // anaeróbico
    expect(hrZoneIndex(160)).toBe(4);  // máximo
    expect(hrZoneIndex(200)).toBe(4);
  });

  it('mantém os limites e pesos históricos', () => {
    expect(HR_ZONE_MINIMUMS).toEqual([0, 100, 120, 140, 160]);
    expect(HR_ZONE_WEIGHTS).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('computeHrSessionStats', () => {
  it('resume média, máximo, mínimo e duração da série', () => {
    const stats = computeHrSessionStats({ samples: serie([100, 120, 140, 160]) });
    expect(stats.avg).toBe(130);
    expect(stats.max).toBe(160);
    expect(stats.min).toBe(100);
    expect(stats.durationSec).toBe(6); // último t
  });

  it('distribui o tempo entre as zonas e aponta a dominante', () => {
    // 4 amostras em 6s → passo de 2s. Três no aeróbico, uma no anaeróbico.
    const stats = computeHrSessionStats({ samples: serie([120, 125, 130, 140]) });
    expect(stats.zoneSecs).toEqual([0, 0, 6, 2, 0]);
    expect(stats.dominant).toBe(2);
  });

  it('pondera o esforço pela zona: mesmo tempo em zona alta pesa mais', () => {
    const leve = computeHrSessionStats({ samples: serie(Array(30).fill(90)) });
    const forte = computeHrSessionStats({ samples: serie(Array(30).fill(170)) });
    expect(forte.effort).toBeGreaterThan(leve.effort);
  });

  it('sem biometria não estima calorias nem %FCmáx', () => {
    const stats = computeHrSessionStats({ samples: serie([130, 135, 140]) });
    expect(stats.estCalories).toBeNull();
    expect(stats.avgPctMax).toBeNull();
  });

  it('descarta a HRV quando a fonte foi reprovada na validação', () => {
    const stats = computeHrSessionStats({
      samples: serie([120, 125]),
      rrIntervalsMs: [800, 810, 795, 805],
      hrvQuality: { status: 'stale' } as any,
    });
    expect(stats.hrvMs).toBeNull();
  });
});

describe('buildHrSessionPayload', () => {
  const base = {
    userId: 'atleta-1',
    startedAt: Date.UTC(2026, 8, 22, 12, 0, 0),
    endedAtMs: Date.UTC(2026, 8, 22, 12, 10, 0),
    samples: serie([120, 130, 140, 150]),
    source: 'ble' as const,
    deviceName: 'Forerunner 165',
  };

  it('monta o registro do histórico com os campos que a tabela espera', () => {
    const row = buildHrSessionPayload(base);
    expect(row.user_id).toBe('atleta-1');
    expect(row.source).toBe('ble');
    expect(row.device_name).toBe('Forerunner 165');
    expect(row.started_at).toBe('2026-09-22T12:00:00.000Z');
    expect(row.ended_at).toBe('2026-09-22T12:10:00.000Z');
    expect(row.avg_bpm).toBe(135);
    expect(row.max_bpm).toBe(150);
    expect(row.samples).toHaveLength(4);
    expect(row.zone_secs).toHaveLength(5);
  });

  it('prefere as calorias reais do relógio à estimativa', () => {
    const row = buildHrSessionPayload({ ...base, deviceCalories: 321, deviceSteps: 1200 });
    expect(row.calories).toBe(321);
    expect(row.calories_source).toBe('device');
    expect(row.steps).toBe(1200);
  });

  it('marca como estimativa quando o relógio não informa calorias', () => {
    const row = buildHrSessionPayload({
      ...base,
      bio: { weightKg: 80, sex: 'male', birthDate: '1990-01-01' },
    });
    expect(row.calories_source).toBe('estimate');
    expect(row.calories).not.toBeNull();
  });

  it('sem calorias de nenhuma fonte, não inventa origem', () => {
    const row = buildHrSessionPayload(base);
    expect(row.calories).toBeNull();
    expect(row.calories_source).toBeNull();
  });

  it('marca a sessão BLE como fonte de HRV mesmo sem relatório de qualidade', () => {
    const row = buildHrSessionPayload(base);
    expect(row.hrv_source_kind).toBe('ble');
    expect(row.hrv_validation_status).toBe('no_data');
  });

  it('o payload do widget e o da tela de resumo coincidem no modo BLE', () => {
    // O widget grava ao encerrar; a tela de resumo grava se o atleta chegar
    // nela. No BLE não há métricas de relógio, então os dois precisam produzir
    // a MESMA linha — é o que permite a trava aceitar qualquer um dos dois.
    const doWidget = buildHrSessionPayload(base);
    const doResumo = buildHrSessionPayload({
      ...base,
      deviceCalories: null,
      deviceSteps: null,
      caloriesSourceOverride: undefined,
    });
    expect(doResumo).toEqual(doWidget);
  });
});
