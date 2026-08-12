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
  /** Como o empate foi desfeito, quando foi. Opcional: quem monta um outcome
   *  na mão (ex: destaque do ranking) não precisa informar. */
  tiebreak?: DuelTiebreak | null;
}

/**
 * Desempate quando dois ou mais entregam EXATAMENTE o mesmo resultado — que é
 * a única forma de empatar, já que o placar é o desempenho.
 *
 * Ritmo (reps/min) não serve: é o mesmo resultado dividido pela mesma duração
 * do WOD, então empata junto. Sobram as duas leituras que dizem a que custo
 * cada um chegou no mesmo número:
 *
 *   1. 'effort'   — menor % da FC máx vence. Mesmo trabalho pagando menos
 *                   batimento é o lado eficiente, a mesma direção que o
 *                   gráfico de comparação já usa. Exige que todos tenham
 *                   registrado a FC.
 *   2. 'strength' — maior força relativa (carga ÷ peso corporal) vence. Exige
 *                   que todos os empatados tenham carga e peso registrados.
 *
 * Sem nenhum dos dois, o empate fica de pé (aposta devolvida) — melhor que
 * inventar um critério.
 */
export type DuelTiebreak = 'effort' | 'strength';

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeDuelScore(
  results: Record<string, string | null>,
  intensity: Record<string, number | null | undefined>,
  participantIds: string[],
  timeBased: boolean,
  parseResult: (r: string, timeBased: boolean) => number,
  /** Força relativa (carga ÷ peso corporal) por atleta — só usada no desempate. */
  strengthById?: Record<string, number | null | undefined>,
): DuelScoreOutcome {
  const entries: Record<string, DuelScoreEntry> = {};

  const valid = participantIds.filter(id => {
    const r = results[id];
    if (!r) return false;
    const v = parseResult(r, timeBased);
    // sentinela de tempo não-parseável
    return !(timeBased && v >= 999999);
  });
  if (valid.length === 0) return { winnerId: null, usedIntensity: false, entries, tiebreak: null };

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

  // Vencedor = maior score
  let bestTotal = -Infinity;
  let winners: string[] = [];
  for (const id of valid) {
    const t = entries[id].total;
    if (t > bestTotal + 1e-9) { bestTotal = t; winners = [id]; }
    else if (Math.abs(t - bestTotal) <= 1e-9) winners.push(id);
  }

  if (winners.length === 1) {
    return { winnerId: winners[0], usedIntensity: allHaveIntensity, entries, tiebreak: null };
  }

  // Empatados no resultado: decide pelo custo (ver DuelTiebreak).
  const decided = breakTie(winners, entries, strengthById);
  return {
    winnerId: decided?.id ?? null,
    usedIntensity: allHaveIntensity,
    entries,
    tiebreak: decided?.by ?? null,
  };
}

/** Menor esforço primeiro; depois maior força relativa. null = segue empatado. */
function breakTie(
  tied: string[],
  entries: Record<string, DuelScoreEntry>,
  strengthById?: Record<string, number | null | undefined>,
): { id: string; by: DuelTiebreak } | null {
  const byEffort = pickBy(tied, id => entries[id]?.effort ?? null, 'min');
  if (byEffort) return { id: byEffort, by: 'effort' };

  const byStrength = pickBy(tied, id => strengthById?.[id] ?? null, 'max');
  if (byStrength) return { id: byStrength, by: 'strength' };

  return null;
}

/**
 * Vencedor único por um critério numérico. null quando algum empatado não tem
 * o número (comparar quem tem contra quem não tem seria premiar o equipamento)
 * ou quando o próprio critério empata.
 */
function pickBy(
  tied: string[],
  valueOf: (id: string) => number | null,
  direction: 'min' | 'max',
): string | null {
  const values = tied.map(id => ({ id, value: valueOf(id) }));
  if (values.some(v => v.value == null)) return null;

  const nums = values.map(v => v.value as number);
  const target = direction === 'min' ? Math.min(...nums) : Math.max(...nums);
  const leaders = values.filter(v => Math.abs((v.value as number) - target) <= 1e-9);
  return leaders.length === 1 ? leaders[0].id : null;
}

// ─── Recap pós-duelo ──────────────────────────────────────────────────────
// Explica em linguagem simples COMO o vencedor levou a melhor. Quem decide é
// sempre o desempenho; a FC entra como leitura ao lado dele — vencer gastando
// menos batimento que os oponentes é o lado eficiente da mesma vitória, o
// mesmo tipo de leitura dos relatórios "Winning the Margins" do CrossFit Games.

export interface DuelEdgeInsight {
  kind: 'performance' | 'effort' | 'efficiency' | 'tiebreak';
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
  const { winnerId, usedIntensity, entries, tiebreak } = outcome;
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

  // Empate no resultado: aí o que decidiu foi o custo, e a frase tem que dizer
  // isso — senão o card anuncia "venceu no desempenho" num duelo em que os
  // dois fizeram exatamente o mesmo número.
  if (tiebreak) {
    insights.push({
      kind: 'tiebreak',
      text: tiebreak === 'effort'
        ? 'Mesmo resultado: levou no desempate por ter gasto menos FC'
        : 'Mesmo resultado: levou no desempate por mover mais carga por quilo de peso',
    });
    summary = tiebreak === 'effort'
      ? 'Empate no resultado — venceu por eficiência: mesma entrega, menos esforço.'
      : 'Empate no resultado — venceu por força relativa: mesma entrega, mais carga por quilo.';
  }

  return { insights, summary };
}
