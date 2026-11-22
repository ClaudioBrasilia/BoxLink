// src/lib/clanRanking.ts
// Critérios de ranking da temporada de times.
//
// O admin escolhe o critério ao abrir a temporada e ele fica gravado junto do
// resto da temporada (box_settings.current_season). Temporadas antigas, sem
// esses campos, caem no padrão histórico: soma de XP.
//
// São três critérios na tela: XP Total, XP dos Melhores (top N) e Resultado de
// WOD. Os três antigos (média por atleta, frequência e engajamento) continuam
// aqui só para ler temporadas já abertas com eles — ver CRITERIA_OPTIONS.
//
// Todas as métricas saem da mesma janela de tempo da temporada (início/fim) e
// contam apenas membros aprovados do time.

// ─── O que pontua para o time ──────────────────────────────────────────────
// Nem todo XP do atleta vira pontuação de time. Só entram as fontes que têm
// trava de repetição (uma vez por dia, por WOD, por desafio ou por semana).
//
// Ficam de fora, de propósito:
//  • 'duel' — vitória em duelo paga 40 XP sem teto, e nada impede dois
//    colegas do MESMO time de duelar em série com WOD personalizado e
//    resultado digitado à mão: seria XP infinito para o time.
//  • 'pr' — 30 XP a cada carga que supere a anterior, sem incremento mínimo
//    (100 → 100,5 → 101kg renderia 90 XP em um minuto).
//  • 'level_up' — sempre 0 XP, é só bônus em moedas.
//
// Elas continuam valendo XP individual (nível, moedas, Liga do mês) — a
// restrição vale só para a pontuação da temporada de times.
export const SEASON_XP_TYPES = [
  'checkin',       // check-in na aula ou solo — 1x por dia
  'wod',           // resultado no placar do dia — 1x por dia
  'wod_complete',  // WOD do box — 1x por WOD publicado
  'challenge',     // desafio do box — 1x por desafio
  'weekly_bonus',  // bônus semanal de frequência — 1x por semana/faixa
] as const;

/** Rótulos das fontes que pontuam, para explicar aos atletas. */
export const SEASON_XP_SOURCES: { icon: string; label: string; limit: string }[] = [
  { icon: '✅', label: 'Check-in no treino', limit: '1x por dia' },
  { icon: '📋', label: 'Resultado no placar do dia', limit: '1x por dia' },
  { icon: '🏋️', label: 'WOD do box', limit: '1x por WOD' },
  { icon: '🎯', label: 'Desafios do box', limit: '1x por desafio' },
  { icon: '🔥', label: 'Bônus semanal de frequência', limit: '1x por semana' },
];

/** Fontes que dão XP ao atleta mas não pontuam para o time. */
export const SEASON_XP_EXCLUDED: { icon: string; label: string }[] = [
  { icon: '⚔️', label: 'Vitória em duelo' },
  { icon: '📈', label: 'Novo PR no Diário' },
];

const SEASON_XP_TYPE_SET = new Set<string>(SEASON_XP_TYPES);

/** O XP desta linha de reward_history conta para a pontuação do time? */
export function countsForSeason(type?: string | null): boolean {
  return !!type && SEASON_XP_TYPE_SET.has(type);
}

export type ClanRankingCriteria =
  | 'total_xp'
  | 'top_xp'
  | 'wod_competition'
  // Legado: temporadas abertas antes da simplificação. Continuam válidos e
  // continuam sendo lidos do banco — só não aparecem mais no seletor.
  | 'avg_xp'
  | 'checkins'
  | 'engagement';

export type ClanTiebreaker = 'checkins' | 'avg_xp' | 'fewer_members' | 'created_first';

export const DEFAULT_CRITERIA: ClanRankingCriteria = 'total_xp';
export const DEFAULT_TIEBREAKER: ClanTiebreaker = 'checkins';

/** Quantos atletas entram na soma quando o critério é de "melhores". */
export const DEFAULT_TOP_N = 6;
export const MIN_TOP_N = 1;
export const MAX_TOP_N = 50;

export interface ClanCriteriaOption {
  id: ClanRankingCriteria;
  icon: string;
  label: string;
  /** Rótulo curto da unidade exibida no card do time. */
  unit: string;
  /** Fórmula em uma linha. */
  formula: string;
  description: string;
  /** Critério antigo: lido de temporadas abertas, mas fora do seletor. */
  deprecated?: boolean;
  /** Ranking em que o menor valor vence (pontos de competição). */
  lowerIsBetter?: boolean;
}

export const CRITERIA_OPTIONS: ClanCriteriaOption[] = [
  {
    id: 'total_xp',
    icon: '⚡',
    label: 'XP Total',
    unit: 'XP',
    formula: 'Soma do XP dos membros',
    description:
      'Soma o XP de todos os membros no período. Simples e direto — mas times maiores levam vantagem.',
  },
  {
    id: 'top_xp',
    icon: '🎯',
    label: 'XP dos Melhores',
    unit: 'XP',
    formula: `Soma do XP dos ${DEFAULT_TOP_N} melhores atletas`,
    description:
      'Soma só o XP dos melhores atletas do time. Mantém a lógica de soma e tira a vantagem de ter mais gente — quem treina mais por pessoa sobe.',
  },
  {
    id: 'wod_competition',
    icon: '🏁',
    label: 'Resultado de WOD',
    unit: 'pts',
    formula: 'Pontos por colocação nos WODs · menor soma vence',
    description:
      'Cada WOD do box vale pontos por colocação: 1º lugar = 1 ponto, 2º = 2, e assim por diante. O time soma os pontos dos seus melhores atletas e vence quem somar menos, como em uma competição.',
    lowerIsBetter: true,
  },
  {
    id: 'avg_xp',
    icon: '⚖️',
    label: 'Média por Atleta',
    unit: 'XP/atleta',
    formula: 'XP do time ÷ nº de membros',
    description:
      'Divide o XP pelo número de membros. Times de tamanhos diferentes competem de igual para igual.',
    deprecated: true,
  },
  {
    id: 'checkins',
    icon: '📅',
    label: 'Frequência',
    unit: 'check-ins',
    formula: 'Total de check-ins do time',
    description:
      'Conta os check-ins do time no período. Premia quem aparece no box, não quem soma mais pontos.',
    deprecated: true,
  },
  {
    id: 'engagement',
    icon: '🔥',
    label: 'Engajamento',
    unit: 'pts',
    formula: 'Média por atleta × % de membros ativos',
    description:
      'Média de XP ponderada pela fatia de membros que pontuaram. Evita o time carregado por um atleta só.',
    deprecated: true,
  },
];

/** Critérios que o admin ainda pode escolher ao abrir uma temporada. */
export const SELECTABLE_CRITERIA = CRITERIA_OPTIONS.filter((o) => !o.deprecated);

export interface ClanTiebreakerOption {
  id: ClanTiebreaker;
  label: string;
  description: string;
}

export const TIEBREAKER_OPTIONS: ClanTiebreakerOption[] = [
  { id: 'checkins', label: 'Mais check-ins', description: 'Vence quem mais treinou no período.' },
  { id: 'avg_xp', label: 'Maior média', description: 'Vence quem tem mais XP por atleta.' },
  { id: 'fewer_members', label: 'Time menor', description: 'Vence quem fez o mesmo com menos gente.' },
  { id: 'created_first', label: 'Criado primeiro', description: 'Vence o time mais antigo da temporada.' },
];

/**
 * Opção do critério, com o rótulo já ajustado ao N da temporada — o mesmo
 * critério "XP dos Melhores" muda de nome quando o admin escolhe top 4.
 */
export function criteriaOption(
  id: ClanRankingCriteria,
  topN: number = DEFAULT_TOP_N,
): ClanCriteriaOption {
  const base = CRITERIA_OPTIONS.find((o) => o.id === id) || CRITERIA_OPTIONS[0];
  if (base.id !== 'top_xp') return base;
  const n = clampTopN(topN);
  return { ...base, label: `XP dos ${n} Melhores`, formula: `Soma do XP dos ${n} melhores atletas` };
}

export function tiebreakerOption(id: ClanTiebreaker): ClanTiebreakerOption {
  return TIEBREAKER_OPTIONS.find((o) => o.id === id) || TIEBREAKER_OPTIONS[0];
}

/** Menor valor vence? (competição por pontos de WOD) */
export function isLowerBetter(criteria: ClanRankingCriteria): boolean {
  return !!criteriaOption(criteria).lowerIsBetter;
}

export function clampTopN(value?: number | null): number {
  // Temporada antiga não tem top_n — null/undefined viram o padrão, não 0.
  if (value === null || value === undefined) return DEFAULT_TOP_N;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_TOP_N;
  return Math.min(MAX_TOP_N, Math.max(MIN_TOP_N, n));
}

export interface SeasonRankingConfig {
  criteria: ClanRankingCriteria;
  tiebreaker: ClanTiebreaker;
  /** Quantos atletas contam na soma dos critérios de "melhores". */
  topN: number;
}

/** Lê o critério gravado na temporada, com fallback para o padrão histórico. */
export function normalizeRankingConfig(
  season?: {
    ranking_criteria?: string | null;
    tiebreaker?: string | null;
    top_n?: number | null;
  } | null,
): SeasonRankingConfig {
  const criteria = CRITERIA_OPTIONS.some((o) => o.id === season?.ranking_criteria)
    ? (season!.ranking_criteria as ClanRankingCriteria)
    : DEFAULT_CRITERIA;
  const tiebreaker = TIEBREAKER_OPTIONS.some((o) => o.id === season?.tiebreaker)
    ? (season!.tiebreaker as ClanTiebreaker)
    : DEFAULT_TIEBREAKER;
  return { criteria, tiebreaker, topN: clampTopN(season?.top_n) };
}

export interface ClanMemberStats {
  userId: string;
  xp: number;
  checkins: number;
  /** Pontos de colocação nos WODs (menor é melhor). */
  wodPoints?: number | null;
  /** Quantos WODs do box o atleta completou no período. */
  wodEvents?: number | null;
}

export interface ClanRankingInput {
  id: string;
  /** Usado só como desempate final determinístico. */
  createdAt?: string | null;
  members: ClanMemberStats[];
}

export interface ClanRankingEntry {
  id: string;
  /** Valor do critério escolhido — é por ele que o ranking ordena. */
  score: number;
  totalXp: number;
  /** XP somado dos N melhores atletas. */
  topXp: number;
  avgXp: number;
  checkins: number;
  memberCount: number;
  /** Membros que pontuaram ao menos 1 XP no período. */
  activeCount: number;
  /** activeCount / memberCount (0..1). */
  activeRate: number;
  /** Pontos de WOD do time — Infinity quando ninguém fez WOD. */
  wodPoints: number;
  /** Quantos resultados de WOD entraram na conta. */
  wodEvents: number;
  /** Quantos atletas tiveram WOD contado (o top N de fato). */
  wodScoredCount: number;
  mvpUserId: string | null;
  mvpXp: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function computeStats(
  clan: ClanRankingInput,
  topN: number,
): Omit<ClanRankingEntry, 'score'> {
  const memberCount = clan.members.length;
  const totalXp = sum(clan.members.map((m) => m.xp || 0));
  const checkins = sum(clan.members.map((m) => m.checkins || 0));
  const activeCount = clan.members.filter((m) => (m.xp || 0) > 0).length;

  const topXp = round1(
    sum(clan.members.map((m) => m.xp || 0).sort((a, b) => b - a).slice(0, topN)),
  );

  let mvpUserId: string | null = null;
  let mvpXp = 0;
  clan.members.forEach((m) => {
    const xp = m.xp || 0;
    if (xp > mvpXp) { mvpXp = xp; mvpUserId = m.userId; }
  });

  // WOD: só entra quem fez pelo menos um WOD. Zero ponto de quem não jogou
  // seria o melhor resultado possível e colocaria o time vazio em 1º lugar.
  const wodScores = clan.members
    .filter((m) => (m.wodEvents || 0) > 0)
    .map((m) => m.wodPoints ?? 0)
    .sort((a, b) => a - b)
    .slice(0, topN);
  const wodEvents = clan.members.reduce((total, m) => total + (m.wodEvents || 0), 0);

  return {
    id: clan.id,
    totalXp,
    topXp,
    avgXp: memberCount > 0 ? round1(totalXp / memberCount) : 0,
    checkins,
    memberCount,
    activeCount,
    activeRate: memberCount > 0 ? activeCount / memberCount : 0,
    wodPoints: wodScores.length > 0 ? round1(sum(wodScores)) : Infinity,
    wodEvents,
    wodScoredCount: wodScores.length,
    mvpUserId,
    mvpXp,
  };
}

function scoreOf(
  stats: Omit<ClanRankingEntry, 'score'>,
  criteria: ClanRankingCriteria,
): number {
  switch (criteria) {
    case 'top_xp':          return stats.topXp;
    case 'wod_competition': return stats.wodPoints;
    case 'avg_xp':          return stats.avgXp;
    case 'checkins':        return stats.checkins;
    case 'engagement':      return round1(stats.avgXp * stats.activeRate);
    case 'total_xp':
    default:                return stats.totalXp;
  }
}

/**
 * Ordena os times pelo critério da temporada.
 *
 * XP e check-ins: maior vence. Resultado de WOD: menor soma vence (são pontos
 * de colocação). Empate no critério → aplica o desempate escolhido → e, se
 * ainda empatar, cai no time criado primeiro (e no id) para a ordem nunca
 * ficar aleatória.
 */
export function rankClans(
  clans: ClanRankingInput[],
  config: SeasonRankingConfig,
): ClanRankingEntry[] {
  const createdAt = new Map(clans.map((c) => [c.id, c.createdAt || '']));
  const lower = isLowerBetter(config.criteria);

  const entries: ClanRankingEntry[] = clans.map((clan) => {
    const stats = computeStats(clan, config.topN);
    return { ...stats, score: scoreOf(stats, config.criteria) };
  });

  const byCreation = (a: ClanRankingEntry, b: ClanRankingEntry) => {
    const ca = createdAt.get(a.id) || '';
    const cb = createdAt.get(b.id) || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };

  const breakTie = (a: ClanRankingEntry, b: ClanRankingEntry) => {
    switch (config.tiebreaker) {
      case 'avg_xp':        return b.avgXp - a.avgXp;
      case 'fewer_members': return a.memberCount - b.memberCount;
      case 'created_first': return byCreation(a, b);
      case 'checkins':
      default:              return b.checkins - a.checkins;
    }
  };

  return entries.sort((a, b) => {
    // A comparação direta também resolve Infinity (time sem WOD) sem gerar
    // NaN: scores iguais caem no desempate antes de qualquer subtração.
    if (a.score !== b.score) return lower ? a.score - b.score : b.score - a.score;
    const tie = breakTie(a, b);
    if (tie !== 0) return tie;
    return byCreation(a, b);
  });
}

/** Valor do score já formatado para exibição (sem a unidade). */
export function formatClanScore(score: number, criteria: ClanRankingCriteria): string {
  // Time sem nenhum WOD no período não tem soma — mostra traço em vez de zero.
  if (!Number.isFinite(score)) return '—';
  if (criteria === 'avg_xp' || criteria === 'engagement') {
    return score.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return Math.round(score).toLocaleString('pt-BR');
}
