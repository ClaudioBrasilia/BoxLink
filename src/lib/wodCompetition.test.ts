import { describe, it, expect } from 'vitest';
import {
  rankWodEvent,
  computeWodStandings,
  wodPointsByUser,
  findUserRow,
  type WodEventInput,
} from './wodCompetition';

const event = (
  results: [string, string | null][],
  type = 'FOR TIME',
  date = '2026-11-01',
): WodEventInput => ({
  wodId: `wod-${date}`,
  date,
  name: 'WOD do dia',
  type,
  results: results.map(([userId, result]) => ({ userId, result })),
});

describe('rankWodEvent', () => {
  it('no FOR TIME o menor tempo ganha e vira 1 ponto', () => {
    const standing = rankWodEvent(event([['a', '15:00'], ['b', '12:30'], ['c', '18:00']]));
    expect(standing.timeBased).toBe(true);
    expect(standing.rows.map((r) => [r.userId, r.place, r.points])).toEqual([
      ['b', 1, 1],
      ['a', 2, 2],
      ['c', 3, 3],
    ]);
  });

  it('no AMRAP quem faz mais rounds+reps ganha', () => {
    const standing = rankWodEvent(event([['a', '5+10'], ['b', '7+2'], ['c', '6+20']], 'AMRAP'));
    expect(standing.timeBased).toBe(false);
    expect(standing.rows.map((r) => r.userId)).toEqual(['b', 'c', 'a']);
    expect(standing.rows[0].points).toBe(1);
  });

  it('empate divide a colocação e o próximo pula (1, 1, 3)', () => {
    const standing = rankWodEvent(event([['a', '12:00'], ['b', '12:00'], ['c', '13:00']]));
    expect(standing.rows.map((r) => [r.userId, r.place])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });

  it('resultado ilegível entra em último em vez de zerar a conta', () => {
    const standing = rankWodEvent(event([['a', '10:00'], ['b', 'fiz tudo'], ['c', '11:00']]));
    expect(standing.rows.map((r) => r.userId)).toEqual(['a', 'c', 'b']);
    expect(standing.rows[2].dnf).toBe(true);
    expect(standing.rows[2].place).toBe(3);
    expect(standing.finishers).toBe(2);
    expect(standing.participants).toBe(3);
  });

  it('quem só postou a definição (resultado vazio) não é participante', () => {
    const standing = rankWodEvent(event([['a', '10:00'], ['b', null], ['c', '   ']]));
    expect(standing.rows).toHaveLength(1);
    expect(standing.rows[0].userId).toBe('a');
  });

  it('duas linhas no mesmo WOD valem a melhor marca', () => {
    const tempo = rankWodEvent(event([['a', '20:00'], ['a', '14:00'], ['b', '15:00']]));
    expect(tempo.rows[0]).toMatchObject({ userId: 'a', result: '14:00', place: 1 });
    expect(tempo.participants).toBe(2);

    const reps = rankWodEvent(event([['a', '4+0'], ['a', '9+5'], ['b', '7+0']], 'AMRAP'));
    expect(reps.rows[0]).toMatchObject({ userId: 'a', result: '9+5', place: 1 });
  });

  it('WOD sem resultado nenhum não quebra o ranking', () => {
    const standing = rankWodEvent(event([]));
    expect(standing.rows).toEqual([]);
    expect(standing.participants).toBe(0);
    expect(standing.finishers).toBe(0);
  });
});

describe('computeWodStandings', () => {
  it('ordena os WODs pela data', () => {
    const standings = computeWodStandings([
      event([['a', '10:00']], 'FOR TIME', '2026-11-10'),
      event([['a', '10:00']], 'FOR TIME', '2026-11-02'),
    ]);
    expect(standings.map((s) => s.date)).toEqual(['2026-11-02', '2026-11-10']);
  });
});

describe('wodPointsByUser', () => {
  it('acumula pontos e conta quantos WODs o atleta fez', () => {
    const standings = computeWodStandings([
      event([['a', '10:00'], ['b', '11:00']], 'FOR TIME', '2026-11-01'),
      event([['a', '11:00'], ['b', '10:00']], 'FOR TIME', '2026-11-02'),
    ]);
    const points = wodPointsByUser(standings);
    expect(points.a).toEqual({ points: 3, events: 2 });
    expect(points.b).toEqual({ points: 3, events: 2 });
  });

  it('atleta que não jogou não aparece — some do time em vez de somar zero', () => {
    const points = wodPointsByUser(computeWodStandings([event([['a', '10:00']])]));
    expect(points.a).toEqual({ points: 1, events: 1 });
    expect(points.b).toBeUndefined();
  });

  it('encontra a linha do atleta em um WOD', () => {
    const [standing] = computeWodStandings([event([['a', '10:00'], ['b', '12:00']])]);
    expect(findUserRow(standing, 'b')).toMatchObject({ place: 2, points: 2 });
    expect(findUserRow(standing, 'zzz')).toBeUndefined();
  });
});
