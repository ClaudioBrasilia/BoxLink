import { describe, it, expect } from 'vitest';
import {
  rankClans,
  normalizeRankingConfig,
  formatClanScore,
  countsForSeason,
  criteriaOption,
  isLowerBetter,
  clampTopN,
  SEASON_XP_TYPES,
  SELECTABLE_CRITERIA,
  CRITERIA_OPTIONS,
  DEFAULT_CRITERIA,
  DEFAULT_TIEBREAKER,
  DEFAULT_TOP_N,
  type ClanRankingCriteria,
  type ClanRankingInput,
  type ClanTiebreaker,
  type SeasonRankingConfig,
} from './clanRanking';

const cfg = (
  criteria: ClanRankingCriteria,
  tiebreaker: ClanTiebreaker = 'checkins',
  topN: number = DEFAULT_TOP_N,
): SeasonRankingConfig => ({ criteria, tiebreaker, topN });

const clan = (id: string, members: [number, number][], createdAt = '2026-01-01'): ClanRankingInput => ({
  id,
  createdAt,
  members: members.map(([xp, checkins], i) => ({ userId: `${id}-u${i}`, xp, checkins })),
});

/** Time com pontos de WOD por atleta: [pontos, quantos WODs]. */
const wodClan = (
  id: string,
  members: ([number, number] | null)[],
  createdAt = '2026-01-01',
): ClanRankingInput => ({
  id,
  createdAt,
  members: members.map((value, i) => ({
    userId: `${id}-u${i}`,
    xp: 0,
    checkins: 0,
    wodPoints: value ? value[0] : null,
    wodEvents: value ? value[1] : 0,
  })),
});

describe('normalizeRankingConfig', () => {
  it('cai no padrão histórico quando a temporada não tem critério', () => {
    expect(normalizeRankingConfig(null)).toEqual({
      criteria: DEFAULT_CRITERIA,
      tiebreaker: DEFAULT_TIEBREAKER,
      topN: DEFAULT_TOP_N,
    });
    expect(normalizeRankingConfig({}).criteria).toBe('total_xp');
  });

  it('ignora valores desconhecidos', () => {
    const config = normalizeRankingConfig({ ranking_criteria: 'sorteio', tiebreaker: 'moeda' });
    expect(config).toEqual({
      criteria: DEFAULT_CRITERIA,
      tiebreaker: DEFAULT_TIEBREAKER,
      topN: DEFAULT_TOP_N,
    });
  });

  it('respeita o critério gravado', () => {
    expect(normalizeRankingConfig({ ranking_criteria: 'avg_xp', tiebreaker: 'fewer_members' }))
      .toMatchObject({ criteria: 'avg_xp', tiebreaker: 'fewer_members' });
  });

  it('lê o top N da temporada e cai no padrão quando falta ou é inválido', () => {
    expect(normalizeRankingConfig({ ranking_criteria: 'top_xp', top_n: 4 }).topN).toBe(4);
    expect(normalizeRankingConfig({ ranking_criteria: 'top_xp' }).topN).toBe(DEFAULT_TOP_N);
    expect(normalizeRankingConfig({ ranking_criteria: 'top_xp', top_n: null }).topN).toBe(DEFAULT_TOP_N);
  });
});

describe('clampTopN', () => {
  it('mantém o N dentro de 1..50', () => {
    expect(clampTopN(3)).toBe(3);
    expect(clampTopN(0)).toBe(1);
    expect(clampTopN(-8)).toBe(1);
    expect(clampTopN(999)).toBe(50);
    expect(clampTopN(undefined)).toBe(DEFAULT_TOP_N);
    expect(clampTopN(Number.NaN)).toBe(DEFAULT_TOP_N);
  });
});

describe('critérios disponíveis', () => {
  it('só XP Total, XP dos Melhores e Resultado de WOD aparecem no seletor', () => {
    expect(SELECTABLE_CRITERIA.map((o) => o.id)).toEqual(['total_xp', 'top_xp', 'wod_competition']);
    expect(SELECTABLE_CRITERIA.some((o) => o.deprecated)).toBe(false);
  });

  it('os critérios antigos continuam existindo para ler temporadas abertas', () => {
    ['avg_xp', 'checkins', 'engagement'].forEach((id) => {
      const option = CRITERIA_OPTIONS.find((o) => o.id === id);
      expect(option?.deprecated).toBe(true);
    });
  });

  it('o rótulo do XP dos Melhores acompanha o N da temporada', () => {
    expect(criteriaOption('top_xp', 4).label).toBe('XP dos 4 Melhores');
    expect(criteriaOption('top_xp', 4).formula).toBe('Soma do XP dos 4 melhores atletas');
    expect(criteriaOption('total_xp', 4).label).toBe('XP Total');
  });

  it('só o Resultado de WOD tem menor-é-melhor', () => {
    expect(isLowerBetter('wod_competition')).toBe(true);
    expect(isLowerBetter('total_xp')).toBe(false);
    expect(isLowerBetter('top_xp')).toBe(false);
    expect(isLowerBetter('checkins')).toBe(false);
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
    const [first] = rankClans([pequeno, grande], cfg('total_xp'));
    expect(first.id).toBe('grande');
    expect(first.score).toBe(500);
  });

  it('top_xp soma só os N melhores — tira a vantagem do time maior', () => {
    // Os 5 do grande somam 500; os 2 do pequeno somam 400. Com N = 2, o
    // grande continua em 200 (2 × 100) e o pequeno em 400: o pequeno vence.
    const ranked = rankClans([grande, pequeno], cfg('top_xp', 'checkins', 2));
    expect(ranked.map((r) => r.id)).toEqual(['pequeno', 'grande']);
    expect(ranked[0].score).toBe(400);
    expect(ranked[1].score).toBe(200);
    expect(ranked[1].topXp).toBe(200);
  });

  it('top_xp mantém o XP total disponível como métrica secundária', () => {
    const [entry] = rankClans([grande], cfg('top_xp', 'checkins', 2));
    expect(entry.totalXp).toBe(500);
    expect(entry.topXp).toBe(200);
  });

  it('avg_xp premia a média — time pequeno na frente', () => {
    const [first] = rankClans([grande, pequeno], cfg('avg_xp'));
    expect(first.id).toBe('pequeno');
    expect(first.score).toBe(200);
  });

  it('checkins ordena por frequência', () => {
    const [first] = rankClans([pequeno, grande], cfg('checkins', 'avg_xp'));
    expect(first.id).toBe('grande');
    expect(first.score).toBe(25);
  });

  it('engagement penaliza o time carregado por um atleta só', () => {
    const estrela = clan('estrela', [[400, 10], [0, 0], [0, 0], [0, 0]]);   // média 100, 25% ativos → 25
    const coletivo = clan('coletivo', [[90, 4], [90, 4], [90, 4], [90, 4]]); // média 90, 100% ativos → 90

    const ranked = rankClans([estrela, coletivo], cfg('engagement'));
    expect(ranked.map((r) => r.id)).toEqual(['coletivo', 'estrela']);
    expect(ranked[0].score).toBe(90);
    expect(ranked[1].score).toBe(25);

    // No critério antigo, o time da estrela venceria.
    const porXp = rankClans([coletivo, estrela], cfg('total_xp'));
    expect(porXp[0].id).toBe('estrela');
  });

  it('desempata por check-ins', () => {
    const a = clan('a', [[100, 2], [100, 2]]);
    const b = clan('b', [[100, 6], [100, 6]]);
    const ranked = rankClans([a, b], cfg('total_xp', 'checkins'));
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('desempata pelo time menor', () => {
    const a = clan('a', [[50, 1], [50, 1], [50, 1], [50, 1]]);
    const b = clan('b', [[100, 1], [100, 1]]);
    const ranked = rankClans([a, b], cfg('total_xp', 'fewer_members'));
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('desempata pelo time criado primeiro', () => {
    const novo = clan('novo', [[100, 1]], '2026-03-10');
    const velho = clan('velho', [[100, 1]], '2026-01-05');
    const ranked = rankClans([novo, velho], cfg('total_xp', 'created_first'));
    expect(ranked.map((r) => r.id)).toEqual(['velho', 'novo']);
  });

  it('empate total cai na criação e no id — ordem nunca é aleatória', () => {
    const a = clan('a', [[10, 1]], '2026-01-01');
    const b = clan('b', [[10, 1]], '2026-01-01');
    expect(rankClans([b, a], cfg('total_xp')).map((r) => r.id)).toEqual(['a', 'b']);
    expect(rankClans([a, b], cfg('total_xp')).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('time sem membros não quebra a média nem o engajamento', () => {
    const vazio = clan('vazio', []);
    const ranked = rankClans([vazio], cfg('avg_xp'));
    expect(ranked[0].score).toBe(0);
    expect(ranked[0].avgXp).toBe(0);
    expect(ranked[0].activeRate).toBe(0);
    expect(ranked[0].mvpUserId).toBeNull();
  });

  it('expõe MVP e membros ativos independente do critério', () => {
    const time = clan('time', [[10, 1], [80, 3], [0, 0]]);
    const [entry] = rankClans([time], cfg('checkins', 'avg_xp'));
    expect(entry.mvpUserId).toBe('time-u1');
    expect(entry.mvpXp).toBe(80);
    expect(entry.activeCount).toBe(2);
    expect(entry.memberCount).toBe(3);
    expect(entry.totalXp).toBe(90);
    expect(entry.avgXp).toBe(30);
  });
});

describe('rankClans — Resultado de WOD', () => {
  it('menor soma de pontos vence', () => {
    const a = wodClan('a', [[1, 1], [3, 1]]);  // 4 pontos
    const b = wodClan('b', [[2, 1], [4, 1]]);  // 6 pontos
    const ranked = rankClans([b, a], cfg('wod_competition'));
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b']);
    expect(ranked[0].score).toBe(4);
    expect(ranked[0].wodPoints).toBe(4);
  });

  it('soma só os N melhores atletas do time', () => {
    // 5 atletas: 1, 2, 3, 10, 12. Com N = 3 conta 1+2+3 = 6.
    const time = wodClan('time', [[1, 1], [2, 1], [3, 1], [10, 1], [12, 1]]);
    const [entry] = rankClans([time], cfg('wod_competition', 'checkins', 3));
    expect(entry.score).toBe(6);
    expect(entry.wodScoredCount).toBe(3);
    expect(entry.wodEvents).toBe(5);
  });

  it('quem não fez WOD não entra na soma com zero ponto', () => {
    const comGente = wodClan('com-gente', [[5, 1], [6, 1]]);     // 11
    const comAusente = wodClan('com-ausente', [[5, 1], null]);   // 5, não 5+0
    const ranked = rankClans([comGente, comAusente], cfg('wod_competition'));
    expect(ranked[0].id).toBe('com-ausente');
    expect(ranked[0].score).toBe(5);
    expect(ranked[0].wodScoredCount).toBe(1);
  });

  it('time sem nenhum WOD fica em último e não quebra a ordenação', () => {
    const jogou = wodClan('jogou', [[9, 2]]);
    const naoJogou = wodClan('nao-jogou', [null, null]);
    const ranked = rankClans([naoJogou, jogou], cfg('wod_competition'));
    expect(ranked.map((r) => r.id)).toEqual(['jogou', 'nao-jogou']);
    expect(ranked[1].score).toBe(Infinity);
    expect(formatClanScore(ranked[1].score, 'wod_competition')).toBe('—');
  });

  it('empate em pontos usa o desempate escolhido', () => {
    const a = wodClan('a', [[3, 1], [4, 1]]);
    const b = wodClan('b', [[1, 1], [6, 1]]);
    const empatado = rankClans([a, b], cfg('wod_competition', 'created_first'));
    expect(empatado[0].score).toBe(7);
    expect(empatado[1].score).toBe(7);
    expect(empatado.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('não usa a ordenação de maior-é-melhor do XP', () => {
    const forteNoXp = { ...wodClan('forte', [[50, 3]]), members: [{ userId: 'x', xp: 999, checkins: 9, wodPoints: 40, wodEvents: 3 }] };
    const fracoNoXp = { ...wodClan('fraco', [[1, 1]]), members: [{ userId: 'y', xp: 0, checkins: 1, wodPoints: 1, wodEvents: 1 }] };
    const ranked = rankClans([forteNoXp, fracoNoXp], cfg('wod_competition'));
    expect(ranked[0].id).toBe('fraco');
  });
});

describe('formatClanScore', () => {
  it('mostra inteiro para XP e check-ins e uma casa para média/engajamento', () => {
    expect(formatClanScore(1234, 'total_xp')).toBe('1.234');
    expect(formatClanScore(12, 'checkins')).toBe('12');
    expect(formatClanScore(87.5, 'avg_xp')).toBe('87,5');
    expect(formatClanScore(25, 'engagement')).toBe('25,0');
  });

  it('mostra pontos de WOD como inteiro e traço quando não há soma', () => {
    expect(formatClanScore(7, 'wod_competition')).toBe('7');
    expect(formatClanScore(Infinity, 'wod_competition')).toBe('—');
  });
});
