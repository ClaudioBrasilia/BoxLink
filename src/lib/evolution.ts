// src/lib/evolution.ts
// Agregações de evolução do atleta (hoje usadas no Perfil).
//
// Nasceram na página "Minha Evolução", que saiu: metade dela repetia Diário e
// Desafios. As contas ficaram e agora alimentam o gráfico de XP e a linha de
// constância no Perfil: XP no período, constância por semana, sequência de
// semanas treinadas e recordes batidos.
//
// Funções puras, sem Supabase: os testes ficam em `evolution.test.ts`.
// Datas do banco chegam como 'YYYY-MM-DD' (checkins, training_logs) ou ISO
// completo (reward_history, personal_records); tudo é reduzido a 'YYYY-MM-DD'
// no fuso do box antes de agrupar, para não trocar de dia à meia-noite UTC.

export const BOX_TIMEZONE = 'America/Sao_Paulo';

/** Períodos oferecidos na tela (em dias). */
export const PERIODS = [30, 90, 365] as const;
export type EvolutionPeriod = (typeof PERIODS)[number];

export interface RewardRow {
  xp: number | null;
  created_at: string;
}

export interface XpPoint {
  key: string;
  label: string;
  /** XP ganho no dia. */
  xp: number;
  /** XP acumulado desde o começo do período. */
  totalXp: number;
}

export interface WeekPoint {
  key: string;
  label: string;
  count: number;
}

/** 'YYYY-MM-DD' no fuso do box. Aceita Date ou string ISO/'YYYY-MM-DD'. */
export function dateKey(value: string | Date, timeZone: string = BOX_TIMEZONE): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  // en-CA devolve exatamente YYYY-MM-DD.
  return date.toLocaleDateString('en-CA', { timeZone });
}

/** Soma (ou subtrai) dias de uma chave 'YYYY-MM-DD' sem depender do fuso local. */
export function shiftDays(key: string, delta: number): string {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return '';
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/** Segunda-feira da semana daquela data (semana do box começa na segunda). */
export function weekStartKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() + 6) % 7; // domingo (0) vira 6
  return shiftDays(key, -offset);
}

function label(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/** Chaves 'YYYY-MM-DD' dentro da janela de `days` dias terminando hoje. */
export function keysInWindow(keys: string[], days: number, now: Date = new Date()): string[] {
  const end = dateKey(now);
  const start = shiftDays(end, -(Math.max(1, days) - 1));
  return keys.filter((key) => key && key >= start && key <= end);
}

/**
 * XP acumulado dia a dia no período. Dias sem recompensa entram com zero para a
 * linha não "pular" datas.
 */
export function buildXpSeries(rewards: RewardRow[], days: number, now: Date = new Date()): XpPoint[] {
  const total = Math.max(1, Math.floor(days));
  const end = dateKey(now);
  const start = shiftDays(end, -(total - 1));

  const byDay = new Map<string, number>();
  for (const reward of rewards) {
    const key = dateKey(reward.created_at);
    if (!key || key < start || key > end) continue;
    const xp = Number(reward.xp) || 0;
    byDay.set(key, (byDay.get(key) || 0) + xp);
  }

  const points: XpPoint[] = [];
  let running = 0;
  for (let i = 0; i < total; i++) {
    const key = shiftDays(start, i);
    const xp = byDay.get(key) || 0;
    running += xp;
    points.push({ key, label: label(key), xp, totalXp: running });
  }
  return points;
}

/** Treinos por semana, da semana mais antiga para a atual. */
export function buildWeeklyConsistency(dates: string[], weeks: number, now: Date = new Date()): WeekPoint[] {
  const total = Math.max(1, Math.floor(weeks));
  const currentWeek = weekStartKey(dateKey(now));
  const start = shiftDays(currentWeek, -7 * (total - 1));

  const counts = new Map<string, number>();
  for (const raw of dates) {
    const key = dateKey(raw);
    if (!key) continue;
    const week = weekStartKey(key);
    if (week < start || week > currentWeek) continue;
    counts.set(week, (counts.get(week) || 0) + 1);
  }

  const points: WeekPoint[] = [];
  for (let i = 0; i < total; i++) {
    const week = shiftDays(start, 7 * i);
    points.push({ key: week, label: label(week), count: counts.get(week) || 0 });
  }
  return points;
}

/**
 * Semanas seguidas com pelo menos um treino, contando de trás para frente.
 * A semana atual sem treino ainda não quebra a sequência (ela está em curso).
 */
export function currentWeekStreak(dates: string[], now: Date = new Date()): number {
  const weeks = new Set(
    dates.map((raw) => weekStartKey(dateKey(raw))).filter((key) => !!key),
  );
  let cursor = weekStartKey(dateKey(now));
  if (!weeks.has(cursor)) cursor = shiftDays(cursor, -7);

  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor = shiftDays(cursor, -7);
  }
  return streak;
}

export interface EvolutionSummary {
  /** XP somado no período. */
  totalXp: number;
  /** XP médio por semana no período. */
  xpPerWeek: number;
  /** Treinos (check-ins no box, treinos do diário no individual) no período. */
  workouts: number;
  workoutsPerWeek: number;
  /** Recordes registrados no período. */
  prs: number;
  /** Semanas seguidas treinando (não limitado ao período). */
  streak: number;
  /** Semanas do período com pelo menos um treino. */
  activeWeeks: number;
  /** Melhor semana do período em número de treinos. */
  bestWeek: number;
  /** Quantidade de semanas consideradas no período. */
  weeksInPeriod: number;
}

export function summarizeEvolution(input: {
  rewards: RewardRow[];
  workoutDates: string[];
  prDates: string[];
  days: number;
  now?: Date;
}): EvolutionSummary {
  const { rewards, workoutDates, prDates, days } = input;
  const now = input.now ?? new Date();
  const totalDays = Math.max(1, Math.floor(days));
  const weeksInPeriod = Math.max(1, Math.round(totalDays / 7));

  const end = dateKey(now);
  const start = shiftDays(end, -(totalDays - 1));
  const inWindow = (key: string) => !!key && key >= start && key <= end;

  const totalXp = rewards.reduce((sum, reward) => {
    const key = dateKey(reward.created_at);
    if (!inWindow(key)) return sum;
    return sum + (Number(reward.xp) || 0);
  }, 0);

  const workouts = workoutDates.filter((raw) => inWindow(dateKey(raw))).length;
  const prs = prDates.filter((raw) => inWindow(dateKey(raw))).length;
  const weekly = buildWeeklyConsistency(workoutDates, weeksInPeriod, now);
  const activeWeeks = weekly.filter((week) => week.count > 0).length;
  const bestWeek = weekly.reduce((max, week) => Math.max(max, week.count), 0);

  return {
    totalXp,
    xpPerWeek: Math.round(totalXp / weeksInPeriod),
    workouts,
    workoutsPerWeek: Math.round((workouts / weeksInPeriod) * 10) / 10,
    prs,
    streak: currentWeekStreak(workoutDates, now),
    activeWeeks,
    bestWeek,
    weeksInPeriod,
  };
}

/** Rótulo curto do período, usado nos chips e nos títulos. */
export function periodLabel(days: EvolutionPeriod | number): string {
  if (days === 365) return '12 meses';
  if (days === 90) return '90 dias';
  if (days === 30) return '30 dias';
  return `${days} dias`;
}
