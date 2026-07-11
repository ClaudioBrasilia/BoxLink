// src/lib/healthMetrics.ts
// ============================================================================
// Lê métricas REAIS do relógio (calorias ativas e passos) do agregador de
// saúde do SO (Health Connect no Android / Apple Health no iOS) para a janela
// de um treino. Usado para enriquecer o resumo de FC.
// ----------------------------------------------------------------------------
// Import dinâmico do plugin → nunca afeta o build web. Falha graciosamente:
// sem plataforma nativa, sem permissão ou sem dados, retorna {}.
// ============================================================================
import { Capacitor } from '@capacitor/core';

export interface WorkoutDeviceMetrics {
  calories?: number; // kcal ativas no período
  steps?: number;
}

function sumSamples(samples: any[] | undefined): number {
  if (!Array.isArray(samples)) return 0;
  return samples.reduce((acc, s) => acc + (Number(s?.value) || 0), 0);
}

export async function readWorkoutMetrics(
  startMs: number,
  endMs: number
): Promise<WorkoutDeviceMetrics> {
  if (!Capacitor.isNativePlatform()) return {};
  if (!startMs || !endMs || endMs <= startMs) return {};

  try {
    const mod = await import('@capgo/capacitor-health');
    const Health = (mod as any).Health;
    if (!Health?.queryAggregated) return {};

    const avail = await Health.isAvailable().catch(() => null);
    if (!avail?.available) return {};

    const startDate = new Date(startMs).toISOString();
    const endDate = new Date(endMs).toISOString();
    const out: WorkoutDeviceMetrics = {};

    // Calorias ativas no período (soma dentro da janela do treino)
    try {
      const r = await Health.queryAggregated({
        dataType: 'calories',
        startDate,
        endDate,
        bucket: 'day',
        aggregation: 'sum',
      });
      const total = Math.round(sumSamples(r?.samples));
      if (total > 0) out.calories = total;
    } catch {
      /* sem permissão/dados de calorias */
    }

    // Passos no período
    try {
      const r = await Health.queryAggregated({
        dataType: 'steps',
        startDate,
        endDate,
        bucket: 'day',
        aggregation: 'sum',
      });
      const total = Math.round(sumSamples(r?.samples));
      if (total > 0) out.steps = total;
    } catch {
      /* sem permissão/dados de passos */
    }

    return out;
  } catch {
    return {};
  }
}
