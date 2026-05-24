// src/utils/rewards.ts
// Função unificada de recompensas — corrige:
// 1. Fonte única de configuração (box_settings.rewards)
// 2. Bônus de level up pago em moedas
// 3. Bônus semanal verificado e pago automaticamente no check-in

import { supabase } from '../lib/supabase';

export async function addReward(
  userId: string,
  type: string,
  xp: number,
  coins: number,
  description: string,
  referenceId?: string
): Promise<{ levelUp: boolean; newXp: number; newCoins: number; newLevel: number } | null> {

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('xp, coins, level, paid_bonuses')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('addReward: erro ao buscar perfil', profileError);
    return null;
  }

  const currentXp    = profile.xp    || 0;
  const currentCoins = profile.coins  || 0;
  const currentLevel = profile.level  || 1;

  let newXp    = currentXp    + xp;
  let newCoins = currentCoins + coins;

  // Nível sobe a cada 100 XP × nível atual
  const xpToNextLevel = currentLevel * 100;
  let newLevel = currentLevel;
  let levelUp  = false;

  if (newXp >= xpToNextLevel) {
    newLevel += 1;
    levelUp   = true;

    // 🎯 CORREÇÃO 1: Pagar bônus de level up em moedas
    const { data: settings } = await supabase
      .from('box_settings').select('rewards').single();
    const levelUpBonus = settings?.rewards?.level_up_bonus_coins ?? 50;
    newCoins += levelUpBonus;

    // Registrar o bônus de level up no histórico
    await supabase.from('reward_history').insert({
      user_id: userId,
      type: 'level_up',
      xp: 0,
      coins: levelUpBonus,
      description: `Level up! Nível ${newLevel} — bônus de ${levelUpBonus} BrazaCoins`,
    });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ xp: newXp, coins: newCoins, level: newLevel, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    console.error('addReward: erro ao atualizar perfil', updateError);
    return null;
  }

  // Inserir no histórico principal
  const insertData: any = {
    user_id: userId,
    type,
    xp,
    coins,
    description:
      referenceId && type !== 'challenge'
        ? `${description} [ref:${referenceId}]`
        : description,
  };
  if (referenceId && type === 'challenge') insertData.challenge_id = referenceId;

  const { error: historyError } = await supabase
    .from('reward_history')
    .insert(insertData);

  if (historyError) {
    await supabase.from('reward_history').insert({
      user_id: userId, type, xp, coins, description,
    });
    console.warn('addReward: fallback reward_history:', historyError.message);
  }

  return { levelUp, newXp, newCoins, newLevel };
}

// 🎯 CORREÇÃO 2: Verificar e pagar bônus semanal automaticamente no check-in
export async function checkAndPayWeeklyBonus(userId: string): Promise<{
  paid: boolean;
  count: number;
  xp: number;
  coins: number;
} | null> {
  try {
    // Pegar check-ins da semana atual (segunda a domingo)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const { data: checkins } = await supabase
      .from('checkins')
      .select('date')
      .eq('user_id', userId)
      .gte('date', mondayStr)
      .lte('date', sundayStr);

    const weekCount = checkins?.length || 0;

    // Bônus disponíveis: 3, 4, 5, 6 treinos por semana
    const bonusThresholds = [6, 5, 4, 3]; // ordem decrescente para pegar o maior elegível
    const eligible = bonusThresholds.find(t => weekCount >= t);
    if (!eligible) return { paid: false, count: weekCount, xp: 0, coins: 0 };

    // Verificar se já pagou esse bônus essa semana
    const bonusKey = `weekly_${eligible}_${mondayStr}`;
    const { data: profile } = await supabase
      .from('profiles')
      .select('paid_bonuses')
      .eq('id', userId)
      .single();

    const paidBonuses: string[] = profile?.paid_bonuses || [];
    if (paidBonuses.includes(bonusKey)) {
      return { paid: false, count: weekCount, xp: 0, coins: 0 };
    }

    // Buscar valores do Admin
    const { data: settings } = await supabase
      .from('box_settings').select('rewards').single();
    const rewards = settings?.rewards || {};
    const xp    = rewards[`weekly_bonus_${eligible}_xp`]    ?? (eligible * 25);
    const coins = rewards[`weekly_bonus_${eligible}_coins`]  ?? (eligible * 5);

    // Marcar como pago
    const newPaidBonuses = [...paidBonuses, bonusKey];
    await supabase.from('profiles')
      .update({ paid_bonuses: newPaidBonuses })
      .eq('id', userId);

    // Pagar o bônus
    await addReward(
      userId,
      'weekly_bonus',
      xp,
      coins,
      `Bônus semanal: ${eligible} treinos na semana de ${mondayStr}`,
    );

    return { paid: true, count: weekCount, xp, coins };
  } catch (err) {
    console.error('checkAndPayWeeklyBonus: erro', err);
    return null;
  }
}

// 🎯 CORREÇÃO 3: Buscar recompensas de uma fonte única (box_settings.rewards)
export async function getRewardSettings() {
  // Tenta box_settings primeiro (fonte principal)
  const { data: boxSettings } = await supabase
    .from('box_settings').select('rewards').single();

  if (boxSettings?.rewards) return boxSettings.rewards;

  // Fallback: avatar_economy_settings (compatibilidade)
  const { data: economy } = await supabase
    .from('avatar_economy_settings').select('*').eq('is_active', true).single();

  return {
    xp_per_checkin:      economy?.xp_per_checkin      ?? 20,
    coins_per_checkin:   economy?.coins_per_checkin    ?? 5,
    wod_xp:              economy?.wod_xp               ?? 10,
    wod_coins:           economy?.wod_coins            ?? 5,
    duel_win_xp:         economy?.duel_win_xp          ?? 40,
    duel_win_coins:      economy?.duel_win_coins        ?? 10,
    level_up_bonus_coins: economy?.level_up_bonus_coins ?? 50,
    weekly_bonus_3_xp:   50,
    weekly_bonus_3_coins: 10,
    weekly_bonus_4_xp:   100,
    weekly_bonus_4_coins: 20,
    weekly_bonus_5_xp:   150,
    weekly_bonus_5_coins: 30,
    weekly_bonus_6_xp:   200,
    weekly_bonus_6_coins: 40,
  };
}
