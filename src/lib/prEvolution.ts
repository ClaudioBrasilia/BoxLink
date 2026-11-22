// src/lib/prEvolution.ts
// Evolução dos recordes pessoais.
//
// `personal_records` guarda cada marca como texto livre ("140kg", "3:45",
// "45 reps") e cada registro novo é uma linha — ou seja, o histórico existe,
// mas não dá para plotar texto. Aqui o valor é interpretado em um número
// comparável e o gráfico usa só um tipo por exercício (misturar 140 kg com 3:45
// no mesmo eixo não significa nada).
//
// Funções puras; testes em `prEvolution.test.ts`.

export type PrKind = 'time' | 'weight' | 'reps';

export interface ParsedPr {
  kind: PrKind;
  /** Segundos para tempo; número puro para carga e repetições. */
  value: number;
  /** Unidade para exibir no eixo ("s", "kg", "lb", "reps"). */
  unit: string;
  /** Texto original, para mostrar no tooltip. */
  raw: string;
}

export interface PrEntry {
  id: string;
  exercise: string;
  value: string;
  date: string;
}

export interface PrPoint {
  date: string;
  label: string;
  value: number;
  raw: string;
  kind: PrKind;
}

export interface PrProgress {
  first: PrPoint;
  last: PrPoint;
  delta: number;
  /** true quando a última marca é melhor que a primeira. */
  improved: boolean;
  /** Tempo melhora quando diminui. */
  lowerIsBetter: boolean;
}

/**
 * Interpreta a marca digitada pelo atleta.
 * Devolve `null` quando não há número nenhum — melhor esconder do gráfico do
 * que plotar zero.
 */
export function parsePrValue(raw: string): ParsedPr | null {
  const text = (raw || '').trim();
  if (!text) return null;

  // Vírgula decimal vira ponto; espaços repetidos somem.
  const normalized = text.replace(/\s+/g, ' ').replace(/(\d),(\d)/g, '$1.$2');

  // Tempo: "3:45" (min:seg) ou "1:02:30" (h:min:seg).
  const time = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time) {
    const [, a, b, c] = time;
    const value = c
      ? Number(a) * 3600 + Number(b) * 60 + Number(c)
      : Number(a) * 60 + Number(b);
    return { kind: 'time', value, unit: 's', raw: text };
  }

  // Carga: "140kg", "140 kg", "225 lb".
  const weight = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs)\b/i);
  if (weight) {
    const unit = weight[2].toLowerCase().startsWith('l') ? 'lb' : 'kg';
    return { kind: 'weight', value: Number(weight[1]), unit, raw: text };
  }

  // Repetições: "45", "45 reps", "12 un".
  const reps = normalized.match(/^(\d+(?:\.\d+)?)\s*(reps?|un|unid\.?|x)?$/i);
  if (reps) return { kind: 'reps', value: Number(reps[1]), unit: 'reps', raw: text };

  // Último recurso: primeiro número do texto ("12 voltas + 8").
  const anyNumber = normalized.match(/(\d+(?:\.\d+)?)/);
  if (anyNumber) return { kind: 'reps', value: Number(anyNumber[1]), unit: '', raw: text };

  return null;
}

/** "YYYY-MM-DD" → "dd/mm/aa" (sem depender de fuso). */
export function shortDate(key: string): string {
  const clean = (key || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  return `${clean.slice(8, 10)}/${clean.slice(5, 7)}/${clean.slice(2, 4)}`;
}

/**
 * Exercícios que já têm histórico suficiente para um gráfico (2+ marcas
 * interpretáveis), do mais recente para o mais antigo.
 */
export function exercisesWithHistory(entries: PrEntry[], min: number = 2): string[] {
  const byExercise = new Map<string, { name: string; count: number; lastDate: string }>();

  for (const entry of entries) {
    const name = (entry.exercise || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const current = byExercise.get(key) || { name, count: 0, lastDate: '' };
    if (parsePrValue(entry.value)) current.count += 1;
    if ((entry.date || '') > current.lastDate) current.lastDate = entry.date || '';
    byExercise.set(key, current);
  }

  return [...byExercise.values()]
    .filter((item) => item.count >= Math.max(2, min))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    .map((item) => item.name);
}

/** Série do exercício, em ordem cronológica e só com o tipo dominante. */
export function buildPrSeries(entries: PrEntry[], exercise: string): PrPoint[] {
  const target = (exercise || '').trim().toLowerCase();
  if (!target) return [];

  const rows: { entry: PrEntry; parsed: ParsedPr }[] = [];
  for (const entry of entries) {
    if ((entry.exercise || '').trim().toLowerCase() !== target) continue;
    const parsed = parsePrValue(entry.value);
    if (parsed) rows.push({ entry, parsed });
  }
  if (rows.length === 0) return [];

  // Tipo dominante: um exercício pode ter marca em kg e depois em tempo
  // (ex.: "Fran" como tempo e como carga). O gráfico segue o tipo mais comum.
  const counts = new Map<PrKind, number>();
  for (const row of rows) counts.set(row.parsed.kind, (counts.get(row.parsed.kind) || 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  return rows
    .filter((row) => row.parsed.kind === dominant)
    .sort((a, b) => {
      const byDate = (a.entry.date || '').localeCompare(b.entry.date || '');
      return byDate !== 0 ? byDate : a.entry.id.localeCompare(b.entry.id);
    })
    .map((row) => ({
      date: row.entry.date,
      label: shortDate(row.entry.date),
      value: row.parsed.value,
      raw: row.parsed.raw,
      kind: dominant,
    }));
}

/** Comparação entre a primeira e a última marca da série. */
export function prProgress(points: PrPoint[]): PrProgress | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const lowerIsBetter = last.kind === 'time';
  const delta = last.value - first.value;
  return {
    first,
    last,
    delta,
    lowerIsBetter,
    improved: lowerIsBetter ? delta < 0 : delta > 0,
  };
}

/** Rótulo curto da unidade para o eixo do gráfico. */
export function prUnitLabel(kind: PrKind): string {
  if (kind === 'time') return 'seg';
  if (kind === 'weight') return 'kg';
  return 'reps';
}

/** Marca em texto amigável a partir do número interpretado. */
export function formatPrPoint(point: PrPoint): string {
  if (point.kind === 'time') {
    const total = Math.round(point.value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return point.raw;
}
