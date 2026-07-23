// src/lib/dailyWods.ts
// Rotação determinística de WODs benchmark para o "WOD do Dia" comunitário.
// Sem depender de admin: todo dia sai um WOD, escolhido pela data.

export interface DailyWod {
  name: string;
  type: string;         // FOR TIME, AMRAP, EMOM, TABATA
  description: string;  // movimentos / detalhes (RX)
  timeBased: boolean;   // true = menor tempo vence | false = mais reps/rounds vence
}

// Benchmarks clássicos ("The Girls" + heróis + alguns formatos)
const WODS: DailyWod[] = [
  { name: 'Fran',     type: 'FOR TIME', timeBased: true,  description: '21-15-9\nThruster (43/30 kg)\nPull-up' },
  { name: 'Cindy',    type: 'AMRAP 20', timeBased: false, description: 'AMRAP 20 min\n5 Pull-up\n10 Push-up\n15 Air Squat' },
  { name: 'Grace',    type: 'FOR TIME', timeBased: true,  description: '30 Clean & Jerk (60/40 kg)' },
  { name: 'Helen',    type: 'FOR TIME', timeBased: true,  description: '3 rounds:\n400 m corrida\n21 KB Swing (24/16 kg)\n12 Pull-up' },
  { name: 'Annie',    type: 'FOR TIME', timeBased: true,  description: '50-40-30-20-10\nDouble-under\nSit-up' },
  { name: 'Diane',    type: 'FOR TIME', timeBased: true,  description: '21-15-9\nDeadlift (100/70 kg)\nHandstand Push-up' },
  { name: 'Karen',    type: 'FOR TIME', timeBased: true,  description: '150 Wall Ball (9/6 kg)' },
  { name: 'Elizabeth',type: 'FOR TIME', timeBased: true,  description: '21-15-9\nClean (60/40 kg)\nRing Dip' },
  { name: 'Chelsea',  type: 'EMOM 30',  timeBased: false, description: 'EMOM 30 min\n5 Pull-up\n10 Push-up\n15 Air Squat' },
  { name: 'Angie',    type: 'FOR TIME', timeBased: true,  description: '100 Pull-up\n100 Push-up\n100 Sit-up\n100 Air Squat' },
  { name: 'Nancy',    type: 'FOR TIME', timeBased: true,  description: '5 rounds:\n400 m corrida\n15 Overhead Squat (43/30 kg)' },
  { name: 'Jackie',   type: 'FOR TIME', timeBased: true,  description: '1000 m remo\n50 Thruster (20 kg)\n30 Pull-up' },
  { name: 'Barbara Tabata', type: 'TABATA', timeBased: false, description: 'Tabata (8x 20s/10s) de:\nPull-up · Push-up · Sit-up · Air Squat' },
  { name: 'Murph',    type: 'FOR TIME', timeBased: true,  description: '1,6 km corrida\n100 Pull-up\n200 Push-up\n300 Air Squat\n1,6 km corrida' },
];

const MS_DAY = 86400000;

/** Índice do dia (fuso Brasil) para escolher o WOD de forma estável. */
function dayIndex(date = new Date()): number {
  const br = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const days = Math.floor(Date.UTC(br.getFullYear(), br.getMonth(), br.getDate()) / MS_DAY);
  return ((days % WODS.length) + WODS.length) % WODS.length;
}

/** WOD do dia para a data informada (padrão: hoje). */
export function getDailyWod(date = new Date()): DailyWod {
  return WODS[dayIndex(date)];
}

/** Data no formato yyyy-MM-dd no fuso Brasil (chave do placar). */
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
