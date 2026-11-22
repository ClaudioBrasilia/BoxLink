import { describe, it, expect } from 'vitest';
import {
  dateKey,
  shiftDays,
  weekStartKey,
  buildXpSeries,
  buildWeeklyConsistency,
  currentWeekStreak,
  summarizeEvolution,
  periodLabel,
} from './evolution';

// Domingo, 22/11/2026 — data de referência dos testes (fuso do box).
const NOW = new Date('2026-11-22T15:00:00-03:00');

describe('dateKey', () => {
  it('mantém uma data que já está em YYYY-MM-DD', () => {
    expect(dateKey('2026-11-22')).toBe('2026-11-22');
  });

  it('converte ISO para o dia no fuso do box', () => {
    // 01:00 UTC do dia 23 ainda é dia 22 em São Paulo.
    expect(dateKey('2026-11-23T01:00:00Z')).toBe('2026-11-22');
  });

  it('devolve vazio para data inválida', () => {
    expect(dateKey('não é data')).toBe('');
  });
});

describe('shiftDays', () => {
  it('anda para trás dentro do mês', () => {
    expect(shiftDays('2026-11-22', -7)).toBe('2026-11-15');
  });

  it('atravessa a virada do ano', () => {
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('atravessa fevereiro em ano bissexto', () => {
    expect(shiftDays('2024-03-01', -1)).toBe('2024-02-29');
  });
});

describe('weekStartKey', () => {
  it('domingo pertence à semana que começou na segunda', () => {
    expect(weekStartKey('2026-11-22')).toBe('2026-11-16');
  });

  it('segunda é o início da própria semana', () => {
    expect(weekStartKey('2026-11-16')).toBe('2026-11-16');
  });
});

describe('buildXpSeries', () => {
  it('devolve um ponto por dia e acumula o XP', () => {
    const series = buildXpSeries(
      [
        { xp: 20, created_at: '2026-11-20T12:00:00Z' },
        { xp: 30, created_at: '2026-11-22T12:00:00Z' },
      ],
      7,
      NOW,
    );
    expect(series).toHaveLength(7);
    expect(series[0].key).toBe('2026-11-16');
    expect(series[series.length - 1].key).toBe('2026-11-22');
    expect(series[series.length - 1].totalXp).toBe(50);
    // 20 XP no dia 20, 30 XP no dia 22.
    expect(series.find((p) => p.key === '2026-11-20')?.xp).toBe(20);
    expect(series.find((p) => p.key === '2026-11-22')?.totalXp).toBe(50);
  });

  it('ignora recompensa fora da janela', () => {
    const series = buildXpSeries([{ xp: 999, created_at: '2025-01-01T12:00:00Z' }], 30, NOW);
    expect(series[series.length - 1].totalXp).toBe(0);
  });

  it('trata xp nulo como zero', () => {
    const series = buildXpSeries([{ xp: null, created_at: '2026-11-22T12:00:00Z' }], 7, NOW);
    expect(series[series.length - 1].totalXp).toBe(0);
  });
});

describe('buildWeeklyConsistency', () => {
  it('conta treinos por semana e preenche semanas vazias', () => {
    const weeks = buildWeeklyConsistency(
      ['2026-11-16', '2026-11-18', '2026-11-22', '2026-11-10'],
      3,
      NOW,
    );
    expect(weeks).toHaveLength(3);
    // A semana de 22/11 (domingo) começou em 16/11 — ela é a semana atual.
    expect(weeks.map((w) => w.key)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks[0].count).toBe(0);
    expect(weeks[1].count).toBe(1); // dia 10
    expect(weeks[2].count).toBe(3); // 16, 18 e 22
  });

  it('ignora datas fora da janela', () => {
    const weeks = buildWeeklyConsistency(['2025-01-01'], 2, NOW);
    expect(weeks.every((w) => w.count === 0)).toBe(true);
  });
});

describe('currentWeekStreak', () => {
  it('conta semanas seguidas até a semana atual', () => {
    const streak = currentWeekStreak(
      ['2026-11-17', '2026-11-10', '2026-11-03', '2026-10-20'],
      NOW,
    );
    // Semana atual (23/11) ainda vazia não quebra; 16/11, 09/11 e 02/11 contam.
    expect(streak).toBe(3);
  });

  it('volta zero sem nenhum treino', () => {
    expect(currentWeekStreak([], NOW)).toBe(0);
  });

  it('para na primeira semana sem treino', () => {
    expect(currentWeekStreak(['2026-11-17', '2026-11-03'], NOW)).toBe(1);
  });
});

describe('summarizeEvolution', () => {
  const summary = summarizeEvolution({
    rewards: [
      { xp: 20, created_at: '2026-11-16T12:00:00Z' },
      { xp: 40, created_at: '2026-11-22T12:00:00Z' },
      { xp: 500, created_at: '2025-06-01T12:00:00Z' },
    ],
    workoutDates: ['2026-11-16', '2026-11-17', '2026-11-22', '2026-11-10', '2025-05-01'],
    prDates: ['2026-11-20', '2025-02-02'],
    days: 28,
    now: NOW,
  });

  it('soma só o XP do período', () => {
    expect(summary.totalXp).toBe(60);
  });

  it('conta treinos e recordes do período', () => {
    expect(summary.workouts).toBe(4);
    expect(summary.prs).toBe(1);
  });

  it('calcula médias por semana', () => {
    expect(summary.weeksInPeriod).toBe(4);
    expect(summary.xpPerWeek).toBe(15);
    expect(summary.workoutsPerWeek).toBe(1);
  });

  it('identifica semanas ativas e a melhor semana', () => {
    // Semanas com treino: 09/11 (dia 10) e 16/11 (16, 17 e 22).
    expect(summary.activeWeeks).toBe(2);
    expect(summary.bestWeek).toBe(3);
  });

  it('mantém a sequência de semanas', () => {
    // 16/11 e 09/11 treinadas; 02/11 não tem treino no conjunto, então para em 2.
    expect(summary.streak).toBe(2);
  });

  it('não divide por zero com período de um dia', () => {
    const single = summarizeEvolution({
      rewards: [],
      workoutDates: [],
      prDates: [],
      days: 1,
      now: NOW,
    });
    expect(single.workoutsPerWeek).toBe(0);
    expect(single.xpPerWeek).toBe(0);
  });
});

describe('periodLabel', () => {
  it('traduz os períodos da tela', () => {
    expect(periodLabel(30)).toBe('30 dias');
    expect(periodLabel(90)).toBe('90 dias');
    expect(periodLabel(365)).toBe('12 meses');
  });
});
