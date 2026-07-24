// src/lib/dailyWods.ts
// Helpers do placar de WODs. O WOD não é sugerido pelo app — cada atleta posta
// o WOD que ele mesmo fez (o "Meu WOD"). Aqui ficam só o parser de resultado e
// a detecção de tipo, usados para ranquear o placar.

const TIME_KEYWORDS = ['FOR TIME', 'TIME', 'TEMPO', 'RFT', 'CHIPPER'];

/** true = menor tempo vence (For Time/RFT) | false = mais reps/rounds vence */
export function isTimeBasedType(wodType?: string | null): boolean {
  const up = (wodType || '').toUpperCase();
  return TIME_KEYWORDS.some(k => up.includes(k));
}

/** Data no formato yyyy-MM-dd no fuso Brasil (chave do placar do dia). */
export function dailyWodDate(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Converte um resultado em número para ranquear.
 * Tempo "12:45" → segundos; "5+12" (AMRAP) → rounds*1000+reps; senão número puro.
 */
export function parseWodResult(result: string, timeBased: boolean): number {
  if (!result) return timeBased ? Infinity : -1;
  const str = result.trim();
  const amrap = str.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (amrap) return parseInt(amrap[1], 10) * 1000 + parseInt(amrap[2], 10);
  if (/^\d+:\d+/.test(str)) {
    const p = str.split(':').map(Number);
    return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
  }
  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? (timeBased ? Infinity : -1) : n;
}
