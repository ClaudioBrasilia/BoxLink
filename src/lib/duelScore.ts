// src/lib/duelScore.ts
// Score do duelo: quem venceu é decidido pelo DESEMPENHO. A FC é leitura, não
// ponto.
//
// Justiça:
//  • Desempenho: resultado de cada um relativo ao MELHOR do duelo (mesmo WOD).
//    O melhor fica 100; os outros, proporcionais.
//  • Esforço (% da FC máx): registrado e mostrado no recap — quem entregou o
//    mesmo resultado com FC menor foi mais eficiente —, mas NÃO soma no placar.
//    O número é auto-declarável (campo digitado no duelo) e sai de uma FC máx
//    estimada por idade (220 − idade), frágil demais para escolher vencedor.
//    Antes ele pesava 30%, o que deixava um resultado PIOR vencer por ter FC
//    mais alta — e contradizia o gráfico de comparação, que lê FC menor como
//    vantagem ("mais eficiente").
//  • `usedIntensity` segue marcando "todos os participantes válidos
//    registraram a FC", que é a condição para comparar esforço lado a lado.
//    Sem isso, ninguém é comparado por ter ou não sensor.

export interface DuelScoreEntry {
  id: string;
  perf: number;            // 0..100 (desempenho relativo ao melhor)
  effort: number | null;   // % da FC máx (null = não comparável)
  total: number;           // score final — hoje igual ao desempenho
}

export interface DuelScoreOutcome {
  winnerId: string | null;      // null = empate ou nenhum resultado válido
  usedIntensity: boolean;       // true = todos registraram a FC (dá pra comparar)
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

  // A FC entra só como leitura do recap — `total` continua sendo o desempenho.
  if (allHaveIntensity) {
    for (const id of valid) {
      const effort = Math.max(0, Math.min(100, intensity[id] as number));
      entries[id].effort = Math.round(effort);
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
// Explica em linguagem simples COMO o vencedor levou a melhor. Quem decide é
// sempre o desempenho; a FC entra como leitura ao lado dele — vencer gastando
// menos batimento que os oponentes é o lado eficiente da mesma vitória, o
// mesmo tipo de leitura dos relatórios "Winning the Margins" do CrossFit Games.

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

  let summary = 'Venceu no desempenho.';

  if (usedIntensity) {
    const effortGap = round1((winner.effort as number) - avg(others.map(o => o.effort as number)));
    const moreEfficient = effortGap <= 0;

    insights.push({
      kind: moreEfficient ? 'efficiency' : 'effort',
      text: moreEfficient
        ? `E com esforço ${Math.abs(effortGap).toFixed(1)}pp menor — mais eficiente`
        : `Esforço ${effortGap.toFixed(1)}pp acima da média dos oponentes`,
    });

    // A FC não muda o vencedor — só conta como ele chegou lá.
    summary = moreEfficient
      ? 'Venceu no desempenho, e gastando menos batimento — mais eficiente.'
      : 'Venceu no desempenho, pagando com mais esforço que a média.';
  }

  return { insights, summary };
}
