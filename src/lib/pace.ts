// src/lib/pace.ts
// Ritmo do WOD em repetições por minuto — quantas reps o atleta sustentou por
// minuto de treino. Serve para comparar densidade de trabalho entre atletas
// (e do mesmo atleta entre WODs diferentes), não só o resultado bruto.
//
//   • FOR TIME  → total de reps prescritas ÷ tempo que o atleta levou
//   • AMRAP     → reps completadas ÷ duração (time cap) do WOD
//
// Retorna null quando falta o dado estruturado necessário (o coach não
// preencheu total de reps / time cap), para a UI simplesmente omitir o ritmo.

const TIME_BASED_KEYWORDS = ['FOR TIME', 'TIME', 'TEMPO', 'RFT', 'CHIPPER'];
const AMRAP_KEYWORDS = ['AMRAP'];

export interface WodPaceMeta {
  type?: string | null;
  repsPerRound?: number | null;
  totalReps?: number | null;
  timeCapMinutes?: number | null;
}

export const isTimeBasedType = (type?: string | null): boolean =>
  TIME_BASED_KEYWORDS.some(k => (type || '').toUpperCase().includes(k));

export const isAmrapType = (type?: string | null): boolean =>
  AMRAP_KEYWORDS.some(k => (type || '').toUpperCase().includes(k));

/** Converte "12:45" ou "1:02:34" em segundos. null se não for formato de tempo. */
export function parseTimeToSeconds(result: string): number | null {
  const str = (result || '').trim();
  if (!/^\d+:\d{1,2}(:\d{1,2})?$/.test(str)) return null;
  const p = str.split(':').map(Number);
  if (p.some(n => Number.isNaN(n))) return null;
  return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}

/**
 * Total de reps completadas num AMRAP a partir de "rounds+reps".
 * Precisa de repsPerRound para converter os rounds. null se faltar.
 */
export function parseAmrapTotalReps(result: string, repsPerRound?: number | null): number | null {
  const m = (result || '').trim().match(/^(\d+)\+(\d+)$/);
  if (!m) return null;
  if (!repsPerRound || repsPerRound <= 0) return null;
  return parseInt(m[1], 10) * repsPerRound + parseInt(m[2], 10);
}

/**
 * Total de reps digitadas direto, sem formato "rounds+reps" (ex.: duelo em
 * que o atleta digitou "150 reps" ou "150"). null se parecer outra coisa
 * (contém ":" → é tempo) ou não sobrar nenhum dígito.
 */
function parsePlainReps(result: string): number | null {
  const str = (result || '').trim();
  if (!str || str.includes(':')) return null;
  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Ritmo em repetições por minuto. null quando não há dados suficientes.
 * Arredonda em 1 casa — "8.4 reps/min" é preciso o bastante para comparar.
 */
export function computeRepsPerMinute(result: string, wod: WodPaceMeta): number | null {
  if (!result) return null;

  // AMRAP: reps completadas ÷ duração do WOD.
  // O resultado pode vir como "rounds+reps" (input estruturado do WOD do dia)
  // ou como um número solto de reps totais (campo livre de duelo, ex: "150
  // reps") — tenta os dois formatos antes de desistir.
  const amrapReps = parseAmrapTotalReps(result, wod.repsPerRound) ?? parsePlainReps(result);
  if (amrapReps != null) {
    const cap = wod.timeCapMinutes;
    if (!cap || cap <= 0) return null;
    return round1(amrapReps / cap);
  }

  // FOR TIME: reps prescritas ÷ tempo do atleta
  const seconds = parseTimeToSeconds(result);
  if (seconds != null && seconds > 0) {
    const total = wod.totalReps;
    if (!total || total <= 0) return null;
    return round1(total / (seconds / 60));
  }

  return null;
}

/** "8.4 reps/min" — ou null, para a UI omitir. */
export function formatPace(pace: number | null): string | null {
  return pace == null ? null : `${pace.toFixed(1)} reps/min`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
