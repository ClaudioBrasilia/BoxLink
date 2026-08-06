// src/lib/duelWorkout.test.ts
// ============================================================================
// Regras de onde o treino de um duelo é registrado. O diário é sempre; o que
// varia é placar (individual) x Rank WOD do box (só com WOD real do box).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { duelWorkoutTargets, duelScaling } from './duelWorkout';

describe('duelWorkoutTargets', () => {
  it('individual entra no placar, nunca no Rank WOD do box', () => {
    expect(duelWorkoutTargets(true, null)).toEqual({ placar: true, boxRanking: false });
  });

  it('individual com WOD do box continua indo só pro placar', () => {
    // Duelo criado por um aluno de box contra um individual pode ter wod_id;
    // ainda assim o individual não entra no ranking do box.
    expect(duelWorkoutTargets(true, 'wod-1')).toEqual({ placar: true, boxRanking: false });
  });

  it('box com WOD real entra no Rank WOD, nunca no placar do individual', () => {
    expect(duelWorkoutTargets(false, 'wod-1')).toEqual({ placar: false, boxRanking: true });
  });

  it('box com WOD personalizado não tem onde ranquear', () => {
    expect(duelWorkoutTargets(false, null)).toEqual({ placar: false, boxRanking: false });
    expect(duelWorkoutTargets(false, undefined)).toEqual({ placar: false, boxRanking: false });
  });
});

describe('duelScaling', () => {
  it('RX vira rx', () => {
    expect(duelScaling('RX')).toBe('rx');
  });

  it('qualquer outra categoria vira scaled', () => {
    expect(duelScaling('SCALED')).toBe('scaled');
    expect(duelScaling('BEGINNER')).toBe('scaled');
  });

  it('sem categoria assume RX (padrão do duelo)', () => {
    expect(duelScaling(null)).toBe('rx');
    expect(duelScaling(undefined)).toBe('rx');
  });
});
