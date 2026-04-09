import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function addReward(userId: string, type: string, xp: number, coins: number, description: string) {
  const { data: profile } = await supabase.from('profiles').select('xp, coins, level').eq('id', userId).single();
  if (!profile) return null;

  const newXp = (profile.xp || 0) + xp;
  const newCoins = (profile.coins || 0) + coins;
  
  // Simple level up logic: levels cost level * 100 XP
  // Level 1 -> 2: 100 XP
  // Level 2 -> 3: 200 XP
  // etc.
  let newLevel = profile.level;
  let xpToNextLevel = newLevel * 100;
  let levelUp = false;
  
  if (newXp >= xpToNextLevel) {
    newLevel += 1;
    levelUp = true;
  }

  const { error: updateError } = await supabase.from('profiles').update({ 
    xp: newXp, 
    coins: newCoins, 
    level: newLevel 
  }).eq('id', userId);

  if (updateError) {
    console.error('Error updating profile:', updateError);
    return null;
  }

  await supabase.from('reward_history').insert({ 
    user_id: userId, 
    type, 
    xp, 
    coins, 
    description 
  });
  
  return { levelUp, newLevel, newXp, newCoins };
}
