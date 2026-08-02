// src/lib/wodSpotlight.ts
// Destaque do WOD do dia: quem liderou o treino comparado com a média do box.
//
// A leitura é a dos gráficos de análise de atleta do CrossFit Games — cada
// métrica vira uma barra indexada (líder x campo) com a vantagem em %. Aqui
// ficam só os dados e o cálculo; o desenho vive em WodSpotlightChart, para a
// TV e o celular mostrarem exatamente o mesmo gráfico.

export interface WodSpotlightData {
  athlete: { id: string; name: string; photoUrl: string | null };
  wodName: string;
  wodType: string;
  /** Quantos atletas postaram resultado neste WOD */
  athleteCount: number;
  /** Menor tempo vence (FOR TIME) x maior número vence (AMRAP) */
  timeBased: boolean;
  leaderResult: string;
  leaderScore: number;
  avgScore: number;
  leaderPace: number | null;
  avgPace: number | null;
  leaderStrength: number | null;
  avgStrength: number | null;
  /**
   * Esforço fisiológico. A TV usa a FC ao vivo em bpm; o duelo usa a % da FC
   * máxima que cada um registrou junto do resultado — daí o rótulo/unidade
   * serem parametrizáveis via hrMeta.
   */
  leaderHr?: number | null;
  avgHr?: number | null;
  hrMeta?: {
    label: string;
    unit: string;
    betterWord: string;
    worseWord: string;
  };
}

export interface SpotlightMetric {
  key: string;
  label: string;
  unit: string;
  mine: number;
  avg: number;
  mineLabel: string;
  avgLabel: string;
  lowerIsBetter: boolean;
  betterWord: string;
  worseWord: string;
}

/** "5:48" a partir de segundos; para reps, o número puro. */
export function formatScore(value: number, timeBased: boolean): string {
  if (!timeBased) return String(Math.round(value));
  const total = Math.round(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Métricas comparáveis do destaque. Cada uma só entra quando existe dos DOIS
 * lados — sem carga registrada, sem números do WOD ou sem relógio conectado, a
 * linha simplesmente não aparece, em vez de mostrar um número vazio.
 */
export function buildSpotlightMetrics(d: WodSpotlightData): SpotlightMetric[] {
  const metrics: SpotlightMetric[] = [
    {
      key: 'result',
      label: 'Resultado do WOD',
      unit: d.timeBased ? 'tempo' : 'repetições',
      mine: d.leaderScore,
      avg: d.avgScore,
      mineLabel: formatScore(d.leaderScore, d.timeBased),
      avgLabel: formatScore(d.avgScore, d.timeBased),
      lowerIsBetter: d.timeBased,
      betterWord: d.timeBased ? 'mais rápido' : 'a mais',
      worseWord: d.timeBased ? 'mais lento' : 'a menos',
    },
  ];

  if (d.leaderPace != null && d.avgPace != null) {
    metrics.push({
      key: 'pace',
      label: 'Ritmo',
      unit: 'reps/min',
      mine: d.leaderPace,
      avg: d.avgPace,
      mineLabel: d.leaderPace.toFixed(1),
      avgLabel: d.avgPace.toFixed(1),
      lowerIsBetter: false,
      betterWord: 'mais ritmo',
      worseWord: 'menos ritmo',
    });
  }

  if (d.leaderStrength != null && d.avgStrength != null) {
    metrics.push({
      key: 'strength',
      label: 'Força relativa',
      unit: 'x peso corporal',
      mine: d.leaderStrength,
      avg: d.avgStrength,
      mineLabel: `${d.leaderStrength.toFixed(2)}x`,
      avgLabel: `${d.avgStrength.toFixed(2)}x`,
      lowerIsBetter: false,
      betterWord: 'mais carga/peso',
      worseWord: 'menos carga/peso',
    });
  }

  if (d.leaderHr != null && d.avgHr != null) {
    const hr = d.hrMeta ?? {
      label: 'FC ao vivo',
      unit: 'bpm',
      betterWord: 'FC mais baixa',
      worseWord: 'FC mais alta',
    };
    metrics.push({
      key: 'hr',
      label: hr.label,
      unit: hr.unit,
      mine: d.leaderHr,
      avg: d.avgHr,
      mineLabel: String(Math.round(d.leaderHr)),
      avgLabel: String(Math.round(d.avgHr)),
      // Menor esforço para o mesmo resultado = mais eficiente.
      lowerIsBetter: true,
      betterWord: hr.betterWord,
      worseWord: hr.worseWord,
    });
  }

  return metrics;
}

export interface SpotlightEdge { pct: number; word: string }

/** As duas maiores vantagens reais do líder, para a frase de fechamento. */
export function computeSpotlightEdges(metrics: SpotlightMetric[]): SpotlightEdge[] {
  return metrics
    .map(m => {
      const better = m.lowerIsBetter ? m.mine < m.avg : m.mine > m.avg;
      const pct = m.avg > 0 ? (Math.abs(m.mine - m.avg) / m.avg) * 100 : 0;
      return { better, pct, word: m.betterWord };
    })
    .filter(e => e.better && e.pct >= 1)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2)
    .map(({ pct, word }) => ({ pct, word }));
}

/** Vantagem de uma métrica: se o líder está melhor e por quantos %. */
export function metricAdvantage(m: SpotlightMetric) {
  const better = m.lowerIsBetter ? m.mine < m.avg : m.mine > m.avg;
  const diffPct = m.avg > 0 ? (Math.abs(m.mine - m.avg) / m.avg) * 100 : 0;
  return { better, diffPct };
}
