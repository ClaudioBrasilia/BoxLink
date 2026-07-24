// src/lib/dailyWods.ts
// Helpers do placar de WODs. O WOD não é sugerido pelo app — cada atleta posta
// o WOD que ele mesmo fez (o "Meu WOD"). Aqui ficam o parser de resultado, a
// detecção de tipo (usados para ranquear o placar) e o postDailyWodResult(),
// que é a única função que grava no placar — usada tanto pelo card "Poste o
// seu WOD" quanto pelo toggle dentro do "Novo Registro", evitando que o
// atleta precise digitar o mesmo WOD duas vezes.

import { supabase } from './supabase';
import { addReward, getRewardSettings, registerSoloCheckin } from '../utils/rewards';

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

export interface PostDailyWodParams {
  userId: string;
  wodName: string;
  wodType: string;
  result: string;
  scaling: 'rx' | 'scaled';
}

export interface PostDailyWodOutcome {
  firstTime: boolean;
  xp: number;
  coins: number;
  weeklyBonusPaid: boolean;
}

/**
 * Grava (upsert) o resultado do dia no placar. Recompensa só na primeira vez
 * do dia — verificado sempre por consulta fresca (nunca por estado local),
 * pois dois lugares diferentes podem chamar esta função no mesmo dia.
 */
export async function postDailyWodResult(params: PostDailyWodParams): Promise<PostDailyWodOutcome> {
  const date = dailyWodDate();
  const { data: existing } = await supabase
    .from('daily_wod_results')
    .select('id')
    .eq('user_id', params.userId)
    .eq('wod_date', date)
    .maybeSingle();
  const firstTime = !existing;

  const { error } = await supabase.from('daily_wod_results').upsert({
    user_id: params.userId,
    wod_date: date,
    wod_name: params.wodName,
    wod_type: params.wodType,
    result: params.result,
    scaling: params.scaling,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,wod_date' });
  if (error) throw error;

  if (!firstTime) return { firstTime: false, xp: 0, coins: 0, weeklyBonusPaid: false };

  const settings = await getRewardSettings();
  const xp = settings?.wod_xp ?? 10;
  const coins = settings?.wod_coins ?? 5;
  await addReward(params.userId, 'wod', xp, coins, `WOD no placar — ${params.wodName}`);
  const checkin = await registerSoloCheckin(params.userId, 'WOD PLACAR');

  return {
    firstTime: true,
    xp: xp + (checkin.xp || 0),
    coins: coins + (checkin.coins || 0),
    weeklyBonusPaid: !!checkin.weekly?.paid,
  };
}
