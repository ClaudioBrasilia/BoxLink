// src/lib/dailyWods.ts
// Helpers do placar de WODs. O WOD não é sugerido pelo app — cada atleta
// escreve o WOD que vai fazer. Um atleta pode postar mais de um WOD no
// mesmo dia (ex: treino dobrado) — cada um é sua própria linha, identificada
// por `id`. O fluxo tem duas etapas, que gravam na MESMA linha quando um
// `id` é passado (sem nunca duplicar), ou criam uma linha nova quando não:
//  1. postWodDefinition() — "Poste seu WOD": nome, tipo, movimentos. Ainda
//     sem resultado, por isso NÃO entra no ranking nem dá recompensa.
//  2. postDailyWodResult() — ao treinar (cronômetro ou Novo Registro):
//     grava o resultado. É o resultado que faz o WOD entrar no ranking e
//     pagar a recompensa — nunca a definição sozinha.

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
  /** Atualiza esta linha se informado; senão cria um novo WOD do dia. */
  id?: string;
}

/**
 * Grava só a DEFINIÇÃO do WOD (nome, tipo, movimentos) — sem resultado e
 * sem recompensa. Não mexe no campo `result`, então se o atleta já tiver
 * treinado esta linha, o resultado registrado é preservado.
 */
export async function postWodDefinition(params: PostWodDefinitionParams): Promise<string> {
  if (params.id) {
    const { error } = await supabase.from('daily_wod_results').update({
      wod_name: params.wodName,
      wod_type: params.wodType,
      description: params.description,
      scaling: params.scaling,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);
    if (error) throw error;
    return params.id;
  }

  const { data, error } = await supabase.from('daily_wod_results').insert({
    user_id: params.userId,
    wod_date: dailyWodDate(),
    wod_name: params.wodName,
    wod_type: params.wodType,
    description: params.description,
    scaling: params.scaling,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export interface PostDailyWodParams {
  userId: string;
  wodName: string;
  wodType: string;
  result: string;
  scaling: 'rx' | 'scaled';
  /** Só sobrescreve a definição se informado — omitido preserva a existente. */
  description?: string;
  /** Linha específica a atualizar (o WOD que acabou de ser treinado). Se
   *  omitido, cria uma nova linha já com o resultado. */
  id?: string;
  /** Carga (kg) opcional — WODs com barra com peso (paridade com o Box). */
  loadKg?: number | null;
}

export interface PostDailyWodOutcome {
  /** Linha gravada — usar para futuras edições (RPE/notas) baterem na mesma linha. */
  id: string;
  firstTime: boolean;
  xp: number;
  coins: number;
  weeklyBonusPaid: boolean;
}

/**
 * Grava o RESULTADO no placar — o que efetivamente coloca o atleta no
 * ranking. Recompensa só na primeira vez que um resultado é registrado
 * NESTA linha (não uma vez por dia: cada WOD extra do dia também
 * recompensa, já que é treino de verdade). Verificado sempre por consulta
 * fresca, pois dois lugares diferentes podem chamar esta função pra mesma linha.
 */
export async function postDailyWodResult(params: PostDailyWodParams): Promise<PostDailyWodOutcome> {
  let rowId = params.id;
  let firstTime: boolean;

  if (rowId) {
    const { data: existing } = await supabase
      .from('daily_wod_results')
      .select('result')
      .eq('id', rowId)
      .maybeSingle();
    firstTime = !existing?.result;

    const payload: Record<string, unknown> = {
      wod_name: params.wodName,
      wod_type: params.wodType,
      result: params.result,
      scaling: params.scaling,
      updated_at: new Date().toISOString(),
    };
    if (params.description) payload.description = params.description;
    // Só mexe na carga se informada — omitida preserva a já gravada nesta linha.
    if (params.loadKg !== undefined) payload.load_kg = params.loadKg;

    const { error } = await supabase.from('daily_wod_results').update(payload).eq('id', rowId);
    if (error) throw error;
  } else {
    firstTime = true;
    const { data, error } = await supabase.from('daily_wod_results').insert({
      user_id: params.userId,
      wod_date: dailyWodDate(),
      wod_name: params.wodName,
      wod_type: params.wodType,
      result: params.result,
      scaling: params.scaling,
      description: params.description || null,
      load_kg: params.loadKg ?? null,
    }).select('id').single();
    if (error) throw error;
    rowId = data.id;
  }

  if (!firstTime) return { id: rowId!, firstTime: false, xp: 0, coins: 0, weeklyBonusPaid: false };

  const settings = await getRewardSettings();
  const xp = settings?.wod_xp ?? 10;
  const coins = settings?.wod_coins ?? 5;
  await addReward(params.userId, 'wod', xp, coins, `WOD no placar — ${params.wodName}`);
  const checkin = await registerSoloCheckin(params.userId, 'WOD PLACAR');

  return {
    id: rowId!,
    firstTime: true,
    xp: xp + (checkin.xp || 0),
    coins: coins + (checkin.coins || 0),
    weeklyBonusPaid: !!checkin.weekly?.paid,
  };
}
