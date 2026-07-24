// src/lib/dailyWods.ts
// Helpers do placar de WODs. O WOD não é sugerido pelo app — cada atleta
// escreve o WOD que vai fazer. O fluxo tem duas etapas, que gravam na MESMA
// linha (user_id, wod_date) sem nunca duplicar:
//  1. postWodDefinition() — "Poste seu WOD": nome, tipo, movimentos. Ainda
//     sem resultado, por isso NÃO entra no ranking nem dá recompensa.
//  2. postDailyWodResult() — ao treinar (cronômetro ou Novo Registro):
//     grava o resultado na mesma linha. É o resultado que faz o WOD entrar
//     no ranking e pagar a recompensa — nunca a definição sozinha.

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

export interface PostWodDefinitionParams {
  userId: string;
  wodName: string;
  wodType: string;
  description: string;
  scaling: 'rx' | 'scaled';
}

/**
 * Grava só a DEFINIÇÃO do WOD do dia (nome, tipo, movimentos) — sem
 * resultado e sem recompensa. Não mexe no campo `result`, então se o
 * atleta já tiver treinado hoje, o resultado registrado é preservado.
 */
export async function postWodDefinition(params: PostWodDefinitionParams): Promise<void> {
  const { error } = await supabase.from('daily_wod_results').upsert({
    user_id: params.userId,
    wod_date: dailyWodDate(),
    wod_name: params.wodName,
    wod_type: params.wodType,
    description: params.description,
    scaling: params.scaling,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,wod_date' });
  if (error) throw error;
}

export interface PostDailyWodParams {
  userId: string;
  wodName: string;
  wodType: string;
  result: string;
  scaling: 'rx' | 'scaled';
  /** Só sobrescreve a definição se informado — omitido preserva a existente. */
  description?: string;
}

export interface PostDailyWodOutcome {
  firstTime: boolean;
  xp: number;
  coins: number;
  weeklyBonusPaid: boolean;
}

/**
 * Grava (upsert) o RESULTADO do dia no placar — o que efetivamente coloca o
 * atleta no ranking. Recompensa só na primeira vez que um resultado é
 * registrado no dia (não na primeira vez que a linha existe: pode já haver
 * uma definição sem resultado, postada antes de treinar). Verificado sempre
 * por consulta fresca, pois dois lugares diferentes podem chamar esta
 * função no mesmo dia.
 */
export async function postDailyWodResult(params: PostDailyWodParams): Promise<PostDailyWodOutcome> {
  const date = dailyWodDate();
  const { data: existing } = await supabase
    .from('daily_wod_results')
    .select('id, result')
    .eq('user_id', params.userId)
    .eq('wod_date', date)
    .maybeSingle();
  const firstTime = !existing?.result;

  const payload: Record<string, unknown> = {
    user_id: params.userId,
    wod_date: date,
    wod_name: params.wodName,
    wod_type: params.wodType,
    result: params.result,
    scaling: params.scaling,
    updated_at: new Date().toISOString(),
  };
  if (params.description) payload.description = params.description;

  const { error } = await supabase.from('daily_wod_results').upsert(payload, { onConflict: 'user_id,wod_date' });
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
