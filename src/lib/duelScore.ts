// src/lib/duelScore.ts
// Score justo do duelo combinando desempenho + esforço (intensidade de FC).
//
// Justiça:
//  • Desempenho: resultado de cada um relativo ao MELHOR do duelo (mesmo WOD).
//    O melhor fica 100; os outros, proporcionais.
//  • Esforço: % da FC máxima de cada atleta — comparado no PRÓPRIO limite,
//    então iniciante e avançado competem de forma justa nesse quesito.
//  • A intensidade só entra no cálculo se TODOS os participantes válidos a
//    registraram. Caso contrário, decide só o desempenho (ninguém é premiado
//    nem punido por ter/não ter sensor de FC).

export const PERF_WEIGHT = 0.7;
export const EFFORT_WEIGHT = 0.3;

export interface DuelScoreEntry {
  id: string;
  perf: number;            // 0..100 (desempenho relativo ao melhor)
  effort: number | null;   // % da FC máx (null = não usado)
  total: number;           // score final
}

export interface DuelScoreOutcome {
  winnerId: string | null;      // null = empate ou nenhum resultado válido
  usedIntensity: boolean;       // true = o esforço pesou no resultado
  entries: Record<string, DuelScoreEntry>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeDuelScore(
  results: Record<string, string | null>,
  intensity: Record<string, number | null | undefined>,
  participantIds: string[],
  timeBased: boolean,
  parseResult: (r: string, timeBased: boolean) => number,
): DuelScoreOutcome {
  const entries: Record<string, DuelScoreEntry> = {};

  const valid = participantIds.filter(id => {
    const r = results[id];
    if (!r) return false;
    const v = parseResult(r, timeBased);
    // sentinela de tempo não-parseável
    return !(timeBased && v >= 999999);
  });
  if (valid.length === 0) return { winnerId: null, usedIntensity: false, entries };

  const vals = valid.map(id => parseResult(results[id]!, timeBased));
  const best = timeBased ? Math.min(...vals) : Math.max(...vals);

  for (const id of valid) {
    const v = parseResult(results[id]!, timeBased);
    const perf = timeBased
      ? (v > 0 ? (best / v) * 100 : 0)
      : (best > 0 ? (v / best) * 100 : 0);
    const p = round1(Math.max(0, Math.min(100, perf)));
    entries[id] = { id, perf: p, effort: null, total: p };
  }

  const allHaveIntensity = valid.every(id => {
    const e = intensity[id];
    return typeof e === 'number' && e > 0;
  });

  if (allHaveIntensity) {
    for (const id of valid) {
      const effort = Math.max(0, Math.min(100, intensity[id] as number));
      entries[id].effort = Math.round(effort);
      entries[id].total = round1(PERF_WEIGHT * entries[id].perf + EFFORT_WEIGHT * effort);
    }
  }

  // Vencedor = maior score; empate → null
  let bestTotal = -Infinity;
  let winners: string[] = [];
  for (const id of valid) {
    const t = entries[id].total;
    if (t > bestTotal + 1e-9) { bestTotal = t; winners = [id]; }
    else if (Math.abs(t - bestTotal) <= 1e-9) winners.push(id);
  }
  return { winnerId: winners.length === 1 ? winners[0] : null, usedIntensity: allHaveIntensity, entries };
}

// ─── Recap pós-duelo ──────────────────────────────────────────────────────
// Explica em linguagem simples POR QUE o vencedor levou a melhor: se foi
// desempenho puro, ou se ele venceu sendo mais "eficiente" (mesmo resultado
// com esforço/FC relativo menor que os oponentes) — o mesmo tipo de leitura
// dos relatórios "Winning the Margins" do CrossFit Games.

export interface DuelEdgeInsight {
  kind: 'performance' | 'effort' | 'efficiency';
  text: string;
}

export interface DuelEdge {
  insights: DuelEdgeInsight[];
  summary: string;
}

export function computeDuelEdge(
  outcome: DuelScoreOutcome,
  participantIds: string[],
): DuelEdge | null {
  const { winnerId, usedIntensity, entries } = outcome;
  if (!winnerId) return null;

  const winner = entries[winnerId];
  const others = participantIds
    .filter(id => id !== winnerId)
    .map(id => entries[id])
    .filter(Boolean) as DuelScoreEntry[];
  if (!winner || others.length === 0) return null;

  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
  const perfGap = round1(winner.perf - avg(others.map(o => o.perf)));

  const insights: DuelEdgeInsight[] = [{
    kind: 'performance',
    text: perfGap >= 0
      ? `Desempenho ${perfGap.toFixed(1)} pts acima da média dos oponentes`
      : `Ficou ${Math.abs(perfGap).toFixed(1)} pts atrás no desempenho`,
  }];

  let summary = 'Venceu no desempenho puro (sem FC registrada por todos).';

  if (usedIntensity) {
    const effortGap = round1((winner.effort as number) - avg(others.map(o => o.effort as number)));
    const moreEfficient = effortGap <= 0;

    insights.push({
      kind: moreEfficient ? 'efficiency' : 'effort',
      text: moreEfficient
        ? `Venceu com esforço ${Math.abs(effortGap).toFixed(1)}pp menor — mais eficiente`
        : `Esforço ${effortGap.toFixed(1)}pp acima da média dos oponentes`,
    });

    const perfContribution = PERF_WEIGHT * perfGap;
    const effortContribution = EFFORT_WEIGHT * effortGap;
    summary = perfContribution >= effortContribution
      ? 'A vantagem veio do desempenho.'
      : moreEfficient
        ? 'A vantagem veio da eficiência — mesmo resultado, menos esforço.'
        : 'A vantagem veio do esforço extra.';
  }

  return { insights, summary };
}
