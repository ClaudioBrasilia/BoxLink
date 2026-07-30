// src/lib/benchmarkCompare.ts
// Compara os PRs/benchmarks de dois atletas (ou um atleta vs a média do box)
// exercício a exercício, e calcula a força relativa (carga ÷ peso corporal)
// para exercícios de carga — o mesmo tipo de leitura do work-to-body-mass
// ratio usado em relatórios de comparação de atletas.

const KG_PER_LB = 0.453592;

const parseNum = (v: string): number => parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
const isTimeUnit = (unit: string): boolean => unit === 'min' || unit === 'seg';
const isLoadUnit = (unit: string): boolean => unit === 'kg' || unit === 'lb';
const round2 = (n: number) => Math.round(n * 100) / 100;
const toKg = (value: string, unit: string): number => unit === 'lb' ? parseNum(value) * KG_PER_LB : parseNum(value);

export interface BenchmarkEntry {
  value: string;
  unit: string;
}

export interface CompareRow {
  exercise: string;
  meValue: string | null;
  otherValue: string | null;
  meBetter: boolean | null; // null = empate ou dado faltando de um dos lados
  meRatio: number | null;   // carga ÷ peso corporal (só exercícios de carga)
  otherRatio: number | null;
}

export interface CompareSummary {
  comparable: number;   // exercícios com dado dos dois lados
  meWins: number;
  otherWins: number;
  ties: number;
  strengthEdge: 'me' | 'other' | null; // quem tem maior força relativa média
}

export function buildCompareRows(
  mine: Record<string, BenchmarkEntry>,
  theirs: Record<string, BenchmarkEntry>,
  myWeightKg: number | null,
  otherWeightKg: number | null,
): CompareRow[] {
  const exercises = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].sort();

  return exercises.map(exercise => {
    const m = mine[exercise];
    const o = theirs[exercise];
    const unit = m?.unit || o?.unit || '';

    let meBetter: boolean | null = null;
    if (m && o) {
      const mv = parseNum(m.value);
      const ov = parseNum(o.value);
      if (mv !== ov) meBetter = isTimeUnit(unit) ? mv < ov : mv > ov;
    }

    const loadBased = isLoadUnit(unit);
    const meRatio = loadBased && m && myWeightKg ? round2(toKg(m.value, m.unit) / myWeightKg) : null;
    const otherRatio = loadBased && o && otherWeightKg ? round2(toKg(o.value, o.unit) / otherWeightKg) : null;

    return {
      exercise,
      meValue: m ? `${m.value} ${m.unit}` : null,
      otherValue: o ? `${o.value} ${o.unit}` : null,
      meBetter,
      meRatio,
      otherRatio,
    };
  });
}

export function summarizeCompare(rows: CompareRow[]): CompareSummary {
  let meWins = 0, otherWins = 0, ties = 0, comparable = 0;
  const meRatios: number[] = [];
  const otherRatios: number[] = [];

  for (const r of rows) {
    if (r.meValue && r.otherValue) {
      comparable++;
      if (r.meBetter === true) meWins++;
      else if (r.meBetter === false) otherWins++;
      else ties++;
    }
    if (r.meRatio != null) meRatios.push(r.meRatio);
    if (r.otherRatio != null) otherRatios.push(r.otherRatio);
  }

  let strengthEdge: CompareSummary['strengthEdge'] = null;
  if (meRatios.length > 0 && otherRatios.length > 0) {
    const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
    const meAvg = avg(meRatios);
    const otherAvg = avg(otherRatios);
    if (Math.abs(meAvg - otherAvg) > 0.01) strengthEdge = meAvg > otherAvg ? 'me' : 'other';
  }

  return { comparable, meWins, otherWins, ties, strengthEdge };
}
