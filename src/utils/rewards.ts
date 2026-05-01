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
    .select('xp, coins, level')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('addReward: erro ao buscar perfil', profileError);
    return null;
  }

  const newXp    = (profile.xp    || 0) + xp;
  const newCoins = (profile.coins  || 0) + coins;

  // Nível sobe a cada 100 XP × nível atual
  const xpToNextLevel = (profile.level || 1) * 100;
  let newLevel = profile.level || 1;
  let levelUp  = false;
  if (newXp >= xpToNextLevel) {
    newLevel += 1;
    levelUp   = true;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ xp: newXp, coins: newCoins, level: newLevel, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    console.error('addReward: erro ao atualizar perfil', updateError);
    return null;
  }

  // Insere no histórico — challenge_id é opcional (coluna adicionada na migration)
  const insertData: any = { user_id: userId, type, xp, coins, description };
  if (referenceId) insertData.challenge_id = referenceId;

  const { error: historyError } = await supabase
    .from('reward_history')
    .insert(insertData);

  if (historyError) {
    // Fallback: tenta sem challenge_id se a coluna não existir ainda
    if (historyError.message?.includes('challenge_id')) {
      await supabase.from('reward_history').insert({
        user_id: userId, type, xp, coins,
        description: referenceId ? `${description} [${referenceId}]` : description,
      });
    } else {
      console.error('addReward: erro ao inserir histórico', historyError);
    }
  }

  // Retorna os novos valores para o chamador atualizar o contexto imediatamente
  return { levelUp, newXp, newCoins, newLevel };
}
