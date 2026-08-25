import { describe, expect, it } from 'vitest';
import { calculateReadiness } from './readiness';

describe('calculateReadiness', () => {
  it('prioriza recuperação quando há dor, independentemente dos demais sinais', () => {
    const result = calculateReadiness({ latestFeeling: 'dor', latestRpe: 4, latestSleepHours: 8 });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('pain');
  });

  it('prioriza recuperação após dois registros consecutivos de cansaço', () => {
    const result = calculateReadiness({ consecutiveTired: 2, latestFeeling: 'cansado' });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('consecutive_tired');
  });

  it('prioriza recuperação com pouco sono e RPE muito alto', () => {
    const result = calculateReadiness({ latestSleepHours: 5.5, latestRpe: 8 });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('short_sleep_high_rpe');
  });

  it('prioriza recuperação quando o RPE está pelo menos 2 pontos acima do baseline', () => {
    const result = calculateReadiness({ latestRpe: 8, averageRpe: 6 });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('rpe_above_baseline');
  });

  it('prioriza recuperação após três sessões consecutivas com RPE alto', () => {
    const result = calculateReadiness({ consecutiveHighRpe: 3, latestRpe: 7 });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('consecutive_high_rpe');
  });

  it('recomenda treino controlado para cansaço isolado', () => {
    const result = calculateReadiness({ latestFeeling: 'cansado', consecutiveTired: 1 });
    expect(result.status).toBe('control');
    expect(result.reasons).toContain('tired');
  });

  it('recomenda treino controlado com sono entre 6 e 7 horas', () => {
    const result = calculateReadiness({ latestSleepHours: 6.5, averageSleepHours: 7.5 });
    expect(result.status).toBe('control');
    expect(result.reasons).toContain('short_sleep');
    expect(result.reasons).toContain('sleep_below_baseline');
  });

  it('recomenda treino controlado com RPE alto, mas sem critério crítico', () => {
    const result = calculateReadiness({ latestRpe: 7, averageRpe: 6.5 });
    expect(result.status).toBe('control');
    expect(result.reasons).toContain('high_rpe');
  });

  it('fica pronto para treinar quando há baseline e nenhum alerta', () => {
    const result = calculateReadiness({ latestFeeling: 'bem', latestRpe: 5, averageRpe: 6, latestSleepHours: 8, averageSleepHours: 7.5 });
    expect(result.status).toBe('ready');
    expect(result.reasons).toEqual(['no_alerts']);
    expect(result.hasEnoughHistory).toBe(true);
  });

  it('fica pronto para treinar com mensagem neutra quando ainda não há histórico', () => {
    const result = calculateReadiness({ latestFeeling: null, latestRpe: null, latestSleepHours: null });
    expect(result.status).toBe('ready');
    expect(result.reasons).toEqual(['insufficient_history']);
    expect(result.hasEnoughHistory).toBe(false);
  });

  it('mantém a precedência de recuperação sobre sinais moderados', () => {
    const result = calculateReadiness({ latestFeeling: 'dor', latestRpe: 7, latestSleepHours: 6.5 });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toEqual(['pain']);
  });

  it('retorna confiança alta quando há baseline e amostras suficientes', () => {
    const result = calculateReadiness({
      latestFeeling: 'bem',
      latestRpe: 5,
      averageRpe: 6,
      rpeSampleCount: 5,
      latestSleepHours: 8,
      averageSleepHours: 7.5,
      sleepSampleCount: 5,
      latestDataDate: new Date().toISOString().slice(0, 10),
    });
    expect(result.confidence).toBe('high');
    expect(result.freshness).toBe('today');
    expect(result.signalsUsed).toEqual(['sensação pós-treino', 'RPE', 'sono']);
    expect(result.sampleCounts).toEqual({ rpe: 5, sleep: 5, cardio: 0, hrv: 0 });
  });

  it('reduz para treino controlado quando a HRV cai pelo menos 15% do baseline', () => {
    const result = calculateReadiness({
      latestFeeling: 'bem',
      latestRpe: 5,
      hrvDeltaPct: -18,
      hrvBaselineCount: 3,
      hrvConfidence: 'high',
    });
    expect(result.status).toBe('control');
    expect(result.reasons).toContain('hrv_suppressed');
    expect(result.signalsUsed).toContain('HRV individual');
  });

  it('prioriza recuperação quando HRV cai muito e há outro sinal de fadiga', () => {
    const result = calculateReadiness({
      latestFeeling: 'cansado',
      latestRpe: 7,
      hrvDeltaPct: -35,
      hrvBaselineCount: 3,
      hrvConfidence: 'high',
    });
    expect(result.status).toBe('recovery');
    expect(result.reasons).toContain('hrv_below_baseline');
  });

  it('não reage a HRV sem baseline individual confiável', () => {
    const result = calculateReadiness({
      latestFeeling: 'bem',
      hrvDeltaPct: -50,
      hrvBaselineCount: 2,
      hrvConfidence: 'medium',
    });
    expect(result.status).toBe('ready');
    expect(result.reasons).toEqual(['insufficient_history']);
  });

  it('retorna confiança inicial quando há dados atuais, mas pouco histórico', () => {
    const result = calculateReadiness({ latestRpe: 5, latestDataDate: new Date().toISOString().slice(0, 10) });
    expect(result.confidence).toBe('medium');
    expect(result.freshness).toBe('today');
    expect(result.signalsUsed).toEqual(['RPE']);
  });

  it('retorna confiança baixa quando não há feedback', () => {
    const result = calculateReadiness({ latestFeeling: null, latestRpe: null, latestSleepHours: null });
    expect(result.confidence).toBe('low');
    expect(result.freshness).toBe('unknown');
    expect(result.signalsUsed).toEqual([]);
  });
});
