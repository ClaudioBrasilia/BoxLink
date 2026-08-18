import { describe, expect, it } from 'vitest';
import { calculateFamilyCardioSignal, classifyWorkoutFamily } from './crossfitReadiness';

const log = (id: string, date: string, effort: number, wodType: string, category: 'wod' | 'forca' = 'wod') => ({
  id,
  date,
  category,
  wod_type: wodType,
  title: wodType,
  description: '',
  effort_index: effort,
});

describe('crossfit readiness', () => {
  it('classifica AMRAP e FOR TIME como metcon', () => {
    expect(classifyWorkoutFamily({ category: 'wod', wodType: 'AMRAP' })).toBe('metcon');
    expect(classifyWorkoutFamily({ category: 'wod', wodType: 'FOR TIME' })).toBe('metcon');
  });

  it('classifica EMOM e TABATA como intervalado', () => {
    expect(classifyWorkoutFamily({ category: 'wod', wodType: 'EMOM' })).toBe('interval');
    expect(classifyWorkoutFamily({ category: 'wod', wodType: 'TABATA' })).toBe('interval');
  });

  it('prioriza força e mobilidade a partir da categoria e descrição', () => {
    expect(classifyWorkoutFamily({ category: 'forca', title: 'Back Squat' })).toBe('strength');
    expect(classifyWorkoutFamily({ category: 'wod', description: 'Mobilidade de quadril' })).toBe('mobility');
  });

  it('usa somente três sessões anteriores da mesma família para o baseline', () => {
    const logs = [
      log('latest', '2026-08-18', 52, 'AMRAP'),
      log('same-1', '2026-08-17', 40, 'FOR TIME'),
      log('same-2', '2026-08-16', 40, 'AMRAP'),
      log('same-3', '2026-08-15', 40, 'FOR TIME'),
      log('strength', '2026-08-14', 90, 'FORCA', 'forca'),
    ];
    const signal = calculateFamilyCardioSignal(logs);
    expect(signal?.family).toBe('metcon');
    expect(signal?.baselineLoad).toBe(40);
    expect(signal?.deltaPct).toBe(30);
    expect(signal?.baselineCount).toBe(3);
    expect(signal?.confidence).toBe('high');
  });

  it('não cria baseline com menos de três sessões comparáveis', () => {
    const signal = calculateFamilyCardioSignal([
      log('latest', '2026-08-18', 52, 'AMRAP'),
      log('same-1', '2026-08-17', 40, 'FOR TIME'),
      log('other', '2026-08-16', 80, 'EMOM'),
    ]);
    expect(signal?.family).toBe('metcon');
    expect(signal?.baselineCount).toBe(1);
    expect(signal?.baselineLoad).toBeNull();
  });
});
