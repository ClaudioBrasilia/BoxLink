// src/lib/effort.ts
// Índice de esforço / intensidade a partir das amostras de FC de um treino.
// Reaproveita zonas e %FCmáx de heartRate.ts — mesma lógica do HeartRateSummary,
// extraída para poder ser usada no cronômetro do "Meu WOD".

import type { HrSample } from '../hooks/useHeartRateSession';
import { Biometrics, ageFromBirthDate, maxHrPercent } from './heartRate';

const ZONE_MINS = [0, 100, 120, 140, 160];
const ZONE_WEIGHTS = [1, 2, 3, 4, 5];
const ZONE_LABELS = ['Repouso', 'Aquecimento', 'Aeróbico', 'Anaeróbico', 'Máximo'];

function zoneIndex(bpm: number): number {
  let idx = 0;
  for (let i = 0; i < ZONE_MINS.length; i++) if (bpm >= ZONE_MINS[i]) idx = i;
  return idx;
}

export interface EffortResult {
  avgBpm: number;
  maxBpm: number;
  avgPctMax: number | null;   // % da FC máxima teórica (220 − idade)
  effortIndex: number;        // carga: minutos por zona × peso da zona
  dominantZone: string;       // zona onde passou mais tempo
  durationSec: number;
}

/** Calcula o esforço do treino. null se não houver amostras suficientes. */
export function computeEffort(samples: HrSample[], bio: Biometrics): EffortResult | null {
  const valid = samples.filter(s => s.bpm > 0);
  if (valid.length < 3) return null;

  const bpms = valid.map(s => s.bpm);
  const avgBpm = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  const maxBpm = Math.max(...bpms);
  const durationSec = samples.length ? samples[samples.length - 1].t : 0;

  const stepSec = samples.length > 1 ? Math.max(1, Math.round(durationSec / (samples.length - 1))) : 2;
  const zoneSecs = new Array(ZONE_MINS.length).fill(0);
  for (const s of valid) zoneSecs[zoneIndex(s.bpm)] += stepSec;
  const dominant = zoneSecs.indexOf(Math.max(...zoneSecs));
  const effortIndex = Math.round(
    zoneSecs.reduce((acc, sec, i) => acc + (sec / 60) * ZONE_WEIGHTS[i], 0),
  );

  const avgPctMax = maxHrPercent(avgBpm, ageFromBirthDate(bio.birthDate));

  return { avgBpm, maxBpm, avgPctMax, effortIndex, dominantZone: ZONE_LABELS[dominant], durationSec };
}

/** Esforço já registrado que acompanha um resultado de WOD. */
export interface WodEffort {
  hrAvgPct: number | null;
  effortIndex: number | null;
  hrZone: string | null;
}

/**
 * Mesmo esforço, mas a partir de uma sessão de FC já gravada
 * (heart_rate_sessions) em vez das amostras ao vivo — é o caminho do Box, onde
 * o atleta mede a FC na tela de Frequência e depois registra o resultado do
 * WOD, sem um cronômetro no meio que pudesse coletar as amostras.
 *
 * `effort` e `dominant_zone` já vêm calculados pelo resumo da sessão; o que
 * falta é a % da FC máxima, que depende da idade do atleta.
 */
export function effortFromSession(
  session: { avg_bpm?: number | null; effort?: number | null; dominant_zone?: number | null } | null,
  bio: Biometrics,
): WodEffort | null {
  if (!session) return null;
  const avgBpm = session.avg_bpm ?? null;
  const hrAvgPct = avgBpm ? maxHrPercent(avgBpm, ageFromBirthDate(bio.birthDate)) : null;
  const zoneIdx = session.dominant_zone;
  const hrZone = zoneIdx != null ? ZONE_LABELS[zoneIdx] ?? null : null;
  const effortIndex = session.effort ?? null;
  // Sem nenhuma das três não há o que anexar ao resultado.
  if (hrAvgPct == null && effortIndex == null && hrZone == null) return null;
  return { hrAvgPct, effortIndex, hrZone };
}

/** Rótulo curto de intensidade para exibir junto ao resultado. */
export function effortLabel(pctMax: number | null): string {
  if (pctMax == null) return 'esforço registrado';
  if (pctMax >= 90) return 'intensidade máxima';
  if (pctMax >= 80) return 'alta intensidade';
  if (pctMax >= 70) return 'intensidade moderada';
  return 'intensidade leve';
}
