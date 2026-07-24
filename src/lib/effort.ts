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

/** Rótulo curto de intensidade para exibir junto ao resultado. */
export function effortLabel(pctMax: number | null): string {
  if (pctMax == null) return 'esforço registrado';
  if (pctMax >= 90) return 'intensidade máxima';
  if (pctMax >= 80) return 'alta intensidade';
  if (pctMax >= 70) return 'intensidade moderada';
  return 'intensidade leve';
}
