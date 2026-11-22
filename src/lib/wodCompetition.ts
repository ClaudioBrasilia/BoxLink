// src/lib/wodCompetition.ts
// Ranking de competição a partir do resultado dos WODs do box.
//
// Regra (a mesma de competição de CrossFit): em cada WOD, o 1º lugar ganha
// 1 ponto, o 2º ganha 2, o 3º ganha 3 — e **quem somar menos pontos vence**.
// Empate no resultado divide a colocação (1, 1, 3), e o próximo atleta herda
// a posição seguinte.
//
// A fonte é o WOD do box (`wods` + `wod_results`): um WOD por dia, o mesmo
// para todo mundo, que é o que uma competição precisa para comparar. O placar
// do dia (`daily_wod_results`) fica de fora de propósito — ali cada atleta
// posta o WOD que quiser, então dois atletas do mesmo dia podem ter feito
// treinos diferentes e a comparação não valeria.
//
// O resultado é texto livre ("12:45", "5+12", "80"), então a conversão para
// número é a mesma do placar do dia (`parseWodResult`) — tempo vira segundos,
// AMRAP vira rounds*1000+reps, e o resto vira número puro.

import { isTimeBasedType, parseWodResult } from './dailyWods';

export interface WodResultInput {
  userId: string;
  result: string | null;
}

export interface WodEventInput {
  wodId: string;
  /** Data do WOD (yyyy-MM-dd). */
  date: string;
  name?: string | null;
  /** Tipo do WOD ("FOR TIME", "AMRAP", ...) — decide a direção do ranking. */
  type?: string | null;
  results: WodResultInput[];
}

export interface WodStandingRow {
  userId: string;
  result: string;
  /** Valor comparável: segundos (for time) ou rounds*1000+reps (AMRAP). */
  score: number;
  /** 1 = melhor. Empate repete a colocação. */
  place: number;
  /** Pontos da competição — iguais à colocação. */
  points: number;
  /** Resultado que não deu para ler: entra em último, sem quebrar a conta. */
  dnf: boolean;
}

export interface WodEventStanding {
  wodId: string;
  date: string;
  name: string;
  timeBased: boolean;
  /** Atletas com resultado válido. */
  finishers: number;
  /** Atletas que apareceram no WOD (válidos + DNF). */
  participants: number;
  rows: WodStandingRow[];
}

export interface WodUserPoints {
  /** Soma dos pontos de colocação em todos os WODs do período. */
  points: number;
  /** Quantos WODs o atleta completou. */
  events: number;
}

/** Um resultado só é válido quando o parser devolveu um número utilizável. */
function isValidScore(score: number): boolean {
  return Number.isFinite(score) && score >= 0;
}

/**
 * Se o atleta tem mais de uma linha no mesmo WOD (o app não trava isso no
 * banco), vale a melhor: menor tempo ou mais reps.
 */
function bestOf(
  current: { result: string; score: number } | undefined,
  candidate: { result: string; score: number },
  timeBased: boolean,
): { result: string; score: number } {
  if (!current) return candidate;
  const currentOk = isValidScore(current.score);
  const candidateOk = isValidScore(candidate.score);
  if (currentOk !== candidateOk) return candidateOk ? candidate : current;
  if (!currentOk && !candidateOk) return current;
  const candidateWins = timeBased
    ? candidate.score < current.score
    : candidate.score > current.score;
  return candidateWins ? candidate : current;
}

/** Ranking de um WOD, com pontos por colocação. */
export function rankWodEvent(event: WodEventInput): WodEventStanding {
  const timeBased = isTimeBasedType(event.type);

  const best = new Map<string, { result: string; score: number }>();
  event.results.forEach((row) => {
    if (!row.userId) return;
    const result = (row.result || '').trim();
    // Sem resultado não é participante: quem só postou a definição do WOD
    // não pode levar último lugar de graça.
    if (!result) return;
    const score = parseWodResult(result, timeBased);
    best.set(row.userId, bestOf(best.get(row.userId), { result, score }, timeBased));
  });

  const rows: WodStandingRow[] = [...best.entries()].map(([userId, value]) => ({
    userId,
    result: value.result,
    score: value.score,
    place: 0,
    points: 0,
    dnf: !isValidScore(value.score),
  }));

  // Tempo: menor primeiro. Reps/rounds: maior primeiro. Resultado inválido
  // cai no fim das duas direções (Infinity no tempo, -1 nas reps).
  rows.sort((a, b) => (timeBased ? a.score - b.score : b.score - a.score));

  let place = 0;
  let previous: number | null = null;
  rows.forEach((row, index) => {
    // Colocação padrão de competição: empate repete e o próximo pula.
    if (previous === null || row.score !== previous) place = index + 1;
    row.place = place;
    row.points = place;
    previous = row.score;
  });

  return {
    wodId: event.wodId,
    date: event.date,
    name: (event.name || 'WOD').trim() || 'WOD',
    timeBased,
    finishers: rows.filter((r) => !r.dnf).length,
    participants: rows.length,
    rows,
  };
}

/** Rankings de todos os WODs, do mais antigo para o mais recente. */
export function computeWodStandings(events: WodEventInput[]): WodEventStanding[] {
  return events
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(rankWodEvent);
}

/**
 * Pontos e quantidade de WODs por atleta.
 *
 * Quem não apareceu em nenhum WOD simplesmente não tem chave aqui — é isso
 * que permite o time ignorar (em vez de somar zero) o atleta que não jogou.
 */
export function wodPointsByUser(standings: WodEventStanding[]): Record<string, WodUserPoints> {
  const byUser: Record<string, WodUserPoints> = {};
  standings.forEach((standing) => {
    standing.rows.forEach((row) => {
      const current = byUser[row.userId] || { points: 0, events: 0 };
      byUser[row.userId] = {
        points: current.points + row.points,
        events: current.events + 1,
      };
    });
  });
  return byUser;
}

/** Resumo do atleta dentro de um WOD, para exibir no card do time. */
export function findUserRow(
  standing: WodEventStanding,
  userId: string,
): WodStandingRow | undefined {
  return standing.rows.find((row) => row.userId === userId);
}
