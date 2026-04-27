import { supabase } from '../lib/supabase';

export async function addReward(userId: string, type: string, xp: number, coins: number, description: string, referenceId?: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('xp, coins, level')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for reward:', profileError);
    return null;
  }

  const newXp = (profile.xp || 0) + xp;
  const newCoins = (profile.coins || 0) + coins;
  
  // Simple level up logic
  const xpToNextLevel = profile.level * 100;
  let newLevel = profile.level;
  let levelUp = false;
  
  if (newXp >= xpToNextLevel) {
    newLevel += 1;
    levelUp = true;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      xp: newXp, 
      coins: newCoins, 
      level: newLevel,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating profile rewards:', updateError);
    return null;
  }

  const insertData: any = { 
    user_id: userId, 
    type, 
    xp, 
    coins, 
    description 
  };

  // If we have a referenceId, we could store it if the column exists.
  // For now, we'll just keep it in the description if we want to be safe,
  // or just ignore it if we don't have the column.
  // The user might have added the column manually in Supabase.
  if (referenceId) {
    insertData.challenge_id = referenceId; // Assuming it might exist
  }

  const { error: historyError } = await supabase
    .from('reward_history')
    .insert(insertData);

  if (historyError) {
    // If challenge_id doesn't exist, try without it
    if (historyError.message.includes('column "challenge_id" of relation "reward_history" does not exist')) {
      await supabase.from('reward_history').insert({ 
        user_id: userId, 
        type, 
        xp, 
        coins, 
        description: `${description} [ID: ${referenceId}]`
      });
    } else {
      console.error('Error inserting reward history:', historyError);
    }
  }
  
  return { levelUp };
}
