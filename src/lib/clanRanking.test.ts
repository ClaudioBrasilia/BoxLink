import { describe, it, expect } from 'vitest';
import {
  rankClans,
  normalizeRankingConfig,
  formatClanScore,
  countsForSeason,
  SEASON_XP_TYPES,
  DEFAULT_CRITERIA,
  DEFAULT_TIEBREAKER,
  type ClanRankingInput,
} from './clanRanking';

const clan = (id: string, members: [number, number][], createdAt = '2026-01-01'): ClanRankingInput => ({
  id,
  createdAt,
  members: members.map(([xp, checkins], i) => ({ userId: `${id}-u${i}`, xp, checkins })),
});

describe('normalizeRankingConfig', () => {
  it('cai no padrão histórico quando a temporada não tem critério', () => {
    expect(normalizeRankingConfig(null)).toEqual({
      criteria: DEFAULT_CRITERIA,
      tiebreaker: DEFAULT_TIEBREAKER,
    });
    expect(normalizeRankingConfig({}).criteria).toBe('total_xp');
  });

  it('ignora valores desconhecidos', () => {
    const cfg = normalizeRankingConfig({ ranking_criteria: 'sorteio', tiebreaker: 'moeda' });
    expect(cfg).toEqual({ criteria: DEFAULT_CRITERIA, tiebreaker: DEFAULT_TIEBREAKER });
  });

  it('respeita o critério gravado', () => {
    expect(normalizeRankingConfig({ ranking_criteria: 'avg_xp', tiebreaker: 'fewer_members' }))
      .toEqual({ criteria: 'avg_xp', tiebreaker: 'fewer_members' });
  });
});

describe('countsForSeason', () => {
  it('aceita as fontes com trava de repetição', () => {
    expect(countsForSeason('checkin')).toBe(true);       // 1x por dia
    expect(countsForSeason('wod')).toBe(true);           // 1x por dia (placar)
    expect(countsForSeason('wod_complete')).toBe(true);  // 1x por WOD do box
    expect(countsForSeason('challenge')).toBe(true);     // 1x por desafio
    expect(countsForSeason('weekly_bonus')).toBe(true);  // 1x por semana
  });

  it('barra o que pode ser repetido à vontade no mesmo dia', () => {
    expect(countsForSeason('duel')).toBe(false);
    expect(countsForSeason('pr')).toBe(false);
    expect(countsForSeason('level_up')).toBe(false);
  });

  it('barra tipo ausente ou desconhecido', () => {
    expect(countsForSeason(null)).toBe(false);
    expect(countsForSeason(undefined)).toBe(false);
    expect(countsForSeason('')).toBe(false);
    expect(countsForSeason('tipo_novo_qualquer')).toBe(false);
  });

  it('a lista enviada ao banco bate com o filtro local', () => {
    expect(SEASON_XP_TYPES.every((t) => countsForSeason(t))).toBe(true);
    expect(SEASON_XP_TYPES).toHaveLength(5);
  });
});

describe('rankClans', () => {
  // Time grande e mediano vs. time pequeno e muito forte por atleta.
  const grande = clan('grande', [[100, 5], [100, 5], [100, 5], [100, 5], [100, 5]]); // 500 XP, 25 check-ins, média 100
  const pequeno = clan('pequeno', [[200, 4], [200, 4]]);                             // 400 XP, 8 check-ins, média 200

  it('total_xp premia a soma — time grande na frente', () => {
    const [first] = rankClans([pequeno, grande], { criteria: 'total_xp', tiebreaker: 'checkins' });
    expect(first.id).toBe('grande');
    expect(first.score).toBe(500);
  });

  it('avg_xp premia a média — time pequeno na frente', () => {
    const [first] = rankClans([grande, pequeno], { criteria: 'avg_xp', tiebreaker: 'checkins' });
    expect(first.id).toBe('pequeno');
    expect(first.score).toBe(200);
  });

  it('checkins ordena por frequência', () => {
    const [first] = rankClans([pequeno, grande], { criteria: 'checkins', tiebreaker: 'avg_xp' });
    expect(first.id).toBe('grande');
    expect(first.score).toBe(25);
  });

  it('engagement penaliza o time carregado por um atleta só', () => {
    const estrela = clan('estrela', [[400, 10], [0, 0], [0, 0], [0, 0]]);   // média 100, 25% ativos → 25
    const coletivo = clan('coletivo', [[90, 4], [90, 4], [90, 4], [90, 4]]); // média 90, 100% ativos → 90

    const ranked = rankClans([estrela, coletivo], { criteria: 'engagement', tiebreaker: 'checkins' });
    expect(ranked.map((r) => r.id)).toEqual(['coletivo', 'estrela']);
    expect(ranked[0].score).toBe(90);
    expect(ranked[1].score).toBe(25);

    // No critério antigo, o time da estrela venceria.
    const porXp = rankClans([coletivo, estrela], { criteria: 'total_xp', tiebreaker: 'checkins' });
    expect(porXp[0].id).toBe('estrela');
  });

  it('desempata por check-ins', () => {
    const a = clan('a', [[100, 2], [100, 2]]);
    const b = clan('b', [[100, 6], [100, 6]]);
    const ranked = rankClans([a, b], { criteria: 'total_xp', tiebreaker: 'checkins' });
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('desempata pelo time menor', () => {
    const a = clan('a', [[50, 1], [50, 1], [50, 1], [50, 1]]);
    const b = clan('b', [[100, 1], [100, 1]]);
    const ranked = rankClans([a, b], { criteria: 'total_xp', tiebreaker: 'fewer_members' });
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('desempata pelo time criado primeiro', () => {
    const novo = clan('novo', [[100, 1]], '2026-03-10');
    const velho = clan('velho', [[100, 1]], '2026-01-05');
    const ranked = rankClans([novo, velho], { criteria: 'total_xp', tiebreaker: 'created_first' });
    expect(ranked.map((r) => r.id)).toEqual(['velho', 'novo']);
  });

  it('empate total cai na criação e no id — ordem nunca é aleatória', () => {
    const a = clan('a', [[10, 1]], '2026-01-01');
    const b = clan('b', [[10, 1]], '2026-01-01');
    expect(rankClans([b, a], { criteria: 'total_xp', tiebreaker: 'checkins' }).map((r) => r.id))
      .toEqual(['a', 'b']);
    expect(rankClans([a, b], { criteria: 'total_xp', tiebreaker: 'checkins' }).map((r) => r.id))
      .toEqual(['a', 'b']);
  });

  it('time sem membros não quebra a média nem o engajamento', () => {
    const vazio = clan('vazio', []);
    const ranked = rankClans([vazio], { criteria: 'avg_xp', tiebreaker: 'checkins' });
    expect(ranked[0].score).toBe(0);
    expect(ranked[0].avgXp).toBe(0);
    expect(ranked[0].activeRate).toBe(0);
    expect(ranked[0].mvpUserId).toBeNull();
  });

  it('expõe MVP e membros ativos independente do critério', () => {
    const time = clan('time', [[10, 1], [80, 3], [0, 0]]);
    const [entry] = rankClans([time], { criteria: 'checkins', tiebreaker: 'avg_xp' });
    expect(entry.mvpUserId).toBe('time-u1');
    expect(entry.mvpXp).toBe(80);
    expect(entry.activeCount).toBe(2);
    expect(entry.memberCount).toBe(3);
    expect(entry.totalXp).toBe(90);
    expect(entry.avgXp).toBe(30);
  });
});

describe('formatClanScore', () => {
  it('mostra inteiro para XP e check-ins e uma casa para média/engajamento', () => {
    expect(formatClanScore(1234, 'total_xp')).toBe('1.234');
    expect(formatClanScore(12, 'checkins')).toBe('12');
    expect(formatClanScore(87.5, 'avg_xp')).toBe('87,5');
    expect(formatClanScore(25, 'engagement')).toBe('25,0');
  });
});
