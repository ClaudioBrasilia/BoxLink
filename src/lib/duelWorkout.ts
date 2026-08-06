// src/lib/duelWorkout.ts
// Registra o treino feito num duelo — sem isso o duelo é um silo: o
// resultado ficava só em `duels.results` e o treino não aparecia no diário,
// não contava streak, não entrava em placar/ranking nem pagava XP de WOD.
//
// Cada atleta registra o PRÓPRIO treino ao submeter o resultado (o RLS de
// training_logs só permite inserir com auth.uid() = user_id), então esta
// função sempre roda no contexto de quem está submetendo.
//
// Onde grava, por tipo de conta:
//   • Diário (training_logs) — os dois. É o registro pessoal que alimenta
//     streak, Evolução e Insights.
//   • Placar (daily_wod_results) — só individual. O placar é a comunidade do
//     individual; aluno de box tem Ranking/WOD do dia próprios e não deve
//     poluir esse placar (mesma regra do DailyWodPanel).
//   • Rank WOD (wod_results) — só box, e só quando o duelo usa um WOD real do
//     box (wod_id). Duelo de WOD personalizado não tem onde ranquear.
//
// Check-in: o individual ganha check-in solo (via postDailyWodResult), que é
// o modelo já estabelecido pra quem treina sozinho. Para o box NÃO geramos
// check-in: lá check-in é presença na academia (geolocalizada) e conta no
// ranking de frequência — um duelo feito de casa não pode virar presença.

import { supabase } from './supabase';
import { postDailyWodResult, dailyWodDate } from './dailyWods';
import { addReward, getRewardSettings } from '../utils/rewards';

export interface RegisterDuelWorkoutParams {
  userId: string;
  duelId: string;
  wodName: string;
  result: string;
  /** Conta individual posta no placar; box vai pro Rank WOD do box. */
  isIndividual: boolean;
  wodType?: string | null;
  description?: string | null;
  /** WOD do box usado no duelo. Null em WOD personalizado. */
  wodId?: string | null;
  /** Categoria do duelo (RX / SCALED / BEGINNER). */
  category?: string | null;
  /** Esforço (% da FC máx) informado junto do resultado. */
  hrAvgPct?: number | null;
  /** Carga (kg) informada junto do resultado. */
  loadKg?: number | null;
}

export interface DuelWorkoutOutcome {
  /** false = este duelo já tinha sido registrado (nada foi refeito). */
  logged: boolean;
  /** Entrou no placar do individual. */
  placar: boolean;
  /** Entrou no Rank WOD do box. */
  boxRanking: boolean;
  xp: number;
  coins: number;
}

const SKIPPED: DuelWorkoutOutcome = { logged: false, placar: false, boxRanking: false, xp: 0, coins: 0 };

/**
 * Onde o treino do duelo deve entrar, além do diário (que é sempre).
 * Individual vai pro placar; box só entra no Rank WOD se o duelo usou um WOD
 * real do box — duelo de WOD personalizado não tem onde ranquear.
 */
export function duelWorkoutTargets(
  isIndividual: boolean,
  wodId?: string | null,
): { placar: boolean; boxRanking: boolean } {
  if (isIndividual) return { placar: true, boxRanking: false };
  return { placar: false, boxRanking: !!wodId };
}

/** Categoria do duelo (RX/SCALED/BEGINNER) → escala usada no placar/ranking. */
export function duelScaling(category?: string | null): 'rx' | 'scaled' {
  return (category || 'RX').toUpperCase() === 'RX' ? 'rx' : 'scaled';
}

export async function registerDuelWorkout(p: RegisterDuelWorkoutParams): Promise<DuelWorkoutOutcome> {
  // Trava de idempotência: um duelo = no máximo um registro por atleta.
  const { data: existing } = await supabase
    .from('training_logs')
    .select('id')
    .eq('user_id', p.userId)
    .eq('duel_id', p.duelId)
    .maybeSingle();
  if (existing) return SKIPPED;

  const scaling = duelScaling(p.category);
  const targets = duelWorkoutTargets(p.isIndividual, p.wodId);

  const { error: logError } = await supabase.from('training_logs').insert({
    user_id: p.userId,
    date: dailyWodDate(),
    title: p.wodName,
    category: 'wod',
    wod_type: p.wodType || null,
    description: p.description || null,
    result: p.result,
    load_kg: p.loadKg ?? null,
    hr_avg_pct: p.hrAvgPct ?? null,
    duel_id: p.duelId,
  });
  if (logError) throw logError;

  let placar = false;
  let boxRanking = false;
  let xp = 0;
  let coins = 0;

  if (targets.placar) {
    // Placar + XP de WOD + check-in solo (tudo já resolvido pelo helper).
    const outcome = await postDailyWodResult({
      userId: p.userId,
      wodName: p.wodName,
      wodType: p.wodType || 'OUTRO',
      result: p.result,
      scaling,
      description: p.description || undefined,
      loadKg: p.loadKg ?? null,
      hrAvgPct: p.hrAvgPct ?? null,
    });
    placar = true;
    xp = outcome.xp;
    coins = outcome.coins;
  } else if (targets.boxRanking && p.wodId) {
    // Só entra no Rank WOD se o atleta ainda não registrou esse WOD por fora
    // (tela do WOD do dia) — nunca sobrescreve o resultado oficial dele.
    const { data: already } = await supabase
      .from('wod_results')
      .select('id')
      .eq('user_id', p.userId)
      .eq('wod_id', p.wodId)
      .maybeSingle();

    if (!already) {
      const { error: resultError } = await supabase.from('wod_results').insert({
        wod_id: p.wodId,
        user_id: p.userId,
        result: p.result,
        type: scaling === 'rx' ? 'RX' : 'Scaled',
      });
      if (!resultError) {
        boxRanking = true;
        const rewards = await getRewardSettings();
        xp = rewards?.wod_xp ?? 10;
        coins = rewards?.wod_coins ?? 5;
        await addReward(p.userId, 'wod_complete', xp, coins, `WOD do duelo — ${p.wodName}`, p.wodId);
      }
    }
  }

  return { logged: true, placar, boxRanking, xp, coins };
}
