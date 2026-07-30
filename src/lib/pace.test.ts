// src/lib/pace.test.ts
// ============================================================================
// Cobertura do ritmo (reps/min) do WOD.
//  • FOR TIME → total de reps prescritas ÷ tempo do atleta.
//  • AMRAP    → (rounds × reps_per_round + reps) ÷ time cap.
//  • Sem o dado estruturado do coach, retorna null (a UI omite o ritmo).
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  computeRepsPerMinute,
  parseTimeToSeconds,
  parseAmrapTotalReps,
  formatPace,
} from './pace';

describe('parseTimeToSeconds', () => {
  it('converte mm:ss', () => {
    expect(parseTimeToSeconds('12:45')).toBe(765);
  });

  it('converte hh:mm:ss', () => {
    expect(parseTimeToSeconds('1:02:34')).toBe(3754);
  });

  it('rejeita formato AMRAP e texto solto', () => {
    expect(parseTimeToSeconds('5+12')).toBeNull();
    expect(parseTimeToSeconds('150 reps')).toBeNull();
  });
});

describe('parseAmrapTotalReps', () => {
  it('soma rounds completos + reps extras', () => {
    expect(parseAmrapTotalReps('5+12', 30)).toBe(162);
  });

  it('sem reps por round não dá para converter', () => {
    expect(parseAmrapTotalReps('5+12', null)).toBeNull();
    expect(parseAmrapTotalReps('5+12', 0)).toBeNull();
  });
});

describe('computeRepsPerMinute', () => {
  it('FOR TIME: 150 reps em 12:30 → 12 reps/min', () => {
    const pace = computeRepsPerMinute('12:30', { type: 'FOR TIME', totalReps: 150 });
    expect(pace).toBe(12);
  });

  it('FOR TIME: quem fez o mesmo WOD mais rápido tem ritmo maior', () => {
    const rapido = computeRepsPerMinute('10:00', { type: 'FOR TIME', totalReps: 150 });
    const lento = computeRepsPerMinute('15:00', { type: 'FOR TIME', totalReps: 150 });
    expect(rapido).toBeGreaterThan(lento!);
  });

  it('AMRAP: 5 rounds de 30 + 12 reps em 20 min → 8.1 reps/min', () => {
    const pace = computeRepsPerMinute('5+12', {
      type: 'AMRAP',
      repsPerRound: 30,
      timeCapMinutes: 20,
    });
    expect(pace).toBe(8.1);
  });

  it('AMRAP: reps totais digitadas direto (duelo em texto livre) também funciona', () => {
    // Duelos pedem o resultado em texto livre — o placeholder sugere "150
    // reps" em vez do formato estruturado "rounds+reps".
    const pace = computeRepsPerMinute('150 reps', { type: 'AMRAP', timeCapMinutes: 20 });
    expect(pace).toBe(7.5);
  });

  it('AMRAP: reps digitadas sem unidade também funciona', () => {
    expect(computeRepsPerMinute('150', { type: 'AMRAP', timeCapMinutes: 20 })).toBe(7.5);
  });

  it('FOR TIME sem total de reps cadastrado → null', () => {
    expect(computeRepsPerMinute('12:30', { type: 'FOR TIME' })).toBeNull();
  });

  it('AMRAP sem time cap cadastrado → null', () => {
    expect(computeRepsPerMinute('5+12', { type: 'AMRAP', repsPerRound: 30 })).toBeNull();
  });

  it('resultado vazio → null', () => {
    expect(computeRepsPerMinute('', { type: 'FOR TIME', totalReps: 150 })).toBeNull();
  });

  it('não divide por zero quando o tempo é 0:00', () => {
    expect(computeRepsPerMinute('0:00', { type: 'FOR TIME', totalReps: 150 })).toBeNull();
  });
});

describe('formatPace', () => {
  it('formata com uma casa decimal', () => {
    expect(formatPace(8.1)).toBe('8.1 reps/min');
  });

  it('null continua null para a UI omitir', () => {
    expect(formatPace(null)).toBeNull();
  });
});
