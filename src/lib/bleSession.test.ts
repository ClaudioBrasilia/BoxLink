import { describe, expect, it } from 'vitest';
import type { BleForegroundSample } from './bleForeground';
import {
  isNativeSessionStale,
  latestSampleAt,
  mergeBleSamples,
  selectNewBleSamples,
} from './bleSession';

function sample(capturedAtMs: number, bpm: number, rr: number[] = []): BleForegroundSample {
  return {
    sessionId: 's1',
    capturedAtMs,
    bpm,
    rrIntervalsMs: rr,
    quality: { rrTotal: rr.length, rrInvalid: 0, rrAdvertised: rr.length > 0, rrPayloadTruncated: false },
  };
}

describe('mergeBleSamples', () => {
  it('ordena por instante de captura', () => {
    const merged = mergeBleSamples([sample(3000, 90)], [sample(1000, 70), sample(2000, 80)]);
    expect(merged.map((s) => s.capturedAtMs)).toEqual([1000, 2000, 3000]);
  });

  it('deduplica amostras repetidas do mesmo instante', () => {
    const merged = mergeBleSamples([sample(1000, 70)], [sample(1000, 70), sample(2000, 80)]);
    expect(merged).toHaveLength(2);
  });

  it('descarta amostras sem BPM ou timestamp numérico', () => {
    const broken = { ...sample(1000, 70), bpm: Number.NaN };
    expect(mergeBleSamples([], [broken, sample(2000, 80)])).toHaveLength(1);
  });
});

describe('selectNewBleSamples', () => {
  it('devolve só o que veio depois do último instante aplicado', () => {
    const stored = [sample(1000, 70, [800]), sample(2000, 80, [790]), sample(3000, 85, [780])];
    expect(selectNewBleSamples(stored, 2000).map((s) => s.capturedAtMs)).toEqual([3000]);
  });

  it('não reaplica intervalos RR quando a sessão é hidratada de novo', () => {
    // Regressão: hidratar a sessão inteira a cada retorno ao app anexava os
    // mesmos RR várias vezes e distorcia o RMSSD.
    const stored = [sample(1000, 70, [800, 810]), sample(2000, 80, [790])];

    let applied = 0;
    const rr: number[] = [];
    for (let volta = 0; volta < 3; volta++) {
      const novas = selectNewBleSamples(stored, applied);
      rr.push(...novas.flatMap((s) => s.rrIntervalsMs));
      applied = latestSampleAt(novas, applied);
    }

    expect(rr).toEqual([800, 810, 790]);
    expect(applied).toBe(2000);
  });

  it('trata afterMs zero como sessão ainda não aplicada', () => {
    const stored = [sample(1000, 70), sample(2000, 80)];
    expect(selectNewBleSamples(stored, 0)).toHaveLength(2);
  });
});

describe('latestSampleAt', () => {
  it('mantém o fallback quando não há amostras novas', () => {
    expect(latestSampleAt([], 5000)).toBe(5000);
  });

  it('nunca regride abaixo do fallback', () => {
    expect(latestSampleAt([sample(1000, 70)], 5000)).toBe(5000);
  });
});

describe('isNativeSessionStale', () => {
  const agora = 1_700_000_000_000;

  it('considera órfã uma sessão ativa sem leituras há minutos', () => {
    expect(isNativeSessionStale(
      { active: true, startedAtMs: agora - 600_000, lastSampleMs: agora - 300_000 },
      agora,
    )).toBe(true);
  });

  it('aceita uma sessão com leitura recente', () => {
    expect(isNativeSessionStale(
      { active: true, startedAtMs: agora - 600_000, lastSampleMs: agora - 3_000 },
      agora,
    )).toBe(false);
  });

  it('usa o início da sessão quando ainda não houve nenhuma leitura', () => {
    expect(isNativeSessionStale({ active: true, startedAtMs: agora - 5_000 }, agora)).toBe(false);
    expect(isNativeSessionStale({ active: true, startedAtMs: agora - 600_000 }, agora)).toBe(true);
  });

  it('ignora sessões já encerradas', () => {
    expect(isNativeSessionStale({ active: false, startedAtMs: 1, lastSampleMs: 1 }, agora)).toBe(false);
  });

  it('não julga uma sessão sem nenhum instante conhecido', () => {
    expect(isNativeSessionStale({ active: true }, agora)).toBe(false);
  });
});
