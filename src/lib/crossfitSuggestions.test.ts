import { describe, expect, it } from 'vitest';
import { buildCrossFitSuggestion } from './crossfitSuggestions';

describe('buildCrossFitSuggestion', () => {
  it('prioriza segurança quando há dor', () => {
    const result = buildCrossFitSuggestion({ status: 'recovery', reasons: ['pain'], family: 'metcon' });
    expect(result.kind).toBe('recovery');
    expect(result.title).toBe('Priorize segurança');
  });

  it('sugere reduzir carga em força com prontidão controlada', () => {
    const result = buildCrossFitSuggestion({ status: 'control', reasons: ['high_rpe'], family: 'strength' });
    expect(result.kind).toBe('scale');
    expect(result.actions.join(' ')).toContain('carga');
  });

  it('sugere técnica para skill ou mobilidade', () => {
    const result = buildCrossFitSuggestion({ status: 'control', reasons: ['short_sleep'], family: 'skill' });
    expect(result.kind).toBe('technique');
    expect(result.title).toBe('Priorize qualidade');
  });

  it('sugere ritmo e escala para metcon controlado', () => {
    const result = buildCrossFitSuggestion({ status: 'control', reasons: ['cardio_load_elevated'], family: 'metcon' });
    expect(result.kind).toBe('pace');
    expect(result.message).toContain('volume');
  });

  it('sugere recuperação para força com estado crítico', () => {
    const result = buildCrossFitSuggestion({ status: 'recovery', reasons: ['consecutive_high_rpe'], family: 'strength' });
    expect(result.kind).toBe('recovery');
    expect(result.title).toBe('Reduza a exigência');
  });

  it('mantém orientação positiva quando pronto e família desconhecida', () => {
    const result = buildCrossFitSuggestion({ status: 'ready', reasons: ['no_alerts'], family: 'unknown' });
    expect(result.kind).toBe('pace');
    expect(result.title).toBe('Siga o treino planejado');
  });
});
