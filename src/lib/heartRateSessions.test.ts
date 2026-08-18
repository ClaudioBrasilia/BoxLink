import { describe, expect, it } from 'vitest';
import { assessHrSessionQuality } from './heartRateSessions';

const session = (durationSec: number, bpms: number[]) => ({
  duration_sec: durationSec,
  samples: bpms.map((bpm, index) => ({ bpm, t: index * 10 })),
});

describe('assessHrSessionQuality', () => {
  it('marca como utilizável uma sessão de pelo menos 10 minutos com 70% de amostras válidas', () => {
    const result = assessHrSessionQuality(session(600, [120, 125, 130, 135, 140, 145, 150, 155, 160, 165]));
    expect(result.level).toBe('high');
    expect(result.usableForWod).toBe(true);
    expect(result.validSampleRatio).toBe(1);
  });

  it('não associa automaticamente uma sessão curta', () => {
    const result = assessHrSessionQuality(session(540, [120, 125, 130, 135, 140, 145, 150, 155, 160, 165]));
    expect(result.usableForWod).toBe(false);
    expect(result.reason).toContain('10 minutos');
  });

  it('não associa automaticamente uma sessão com muitas amostras inválidas', () => {
    const result = assessHrSessionQuality(session(900, [120, 0, 0, 0, 0, 125, 0, 0, 0, 0]));
    expect(result.usableForWod).toBe(false);
    expect(result.validSampleRatio).toBe(0.2);
    expect(result.reason).toContain('amostras inválidas');
  });
});
