import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { formatInTimeZone } from "date-fns-tz";
import cors from "cors";
import bodyParser from "body-parser";

import fs from "fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const TIMEZONE = "America/Sao_Paulo";

app.use(cors());
app.use(bodyParser.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const getSupabase = (useServiceRole = false) => {
  return createClient(supabaseUrl, useServiceRole ? supabaseServiceKey : supabaseKey);
};

import { addReward } from "./src/lib/rewardService";

// API Routes
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/rankings", async (req, res) => {
  try {
    // XP Rank
    const { data: xpRank, error: xpError } = await getSupabase()
      .from('profiles')
      .select('*')
      .order('xp', { ascending: false });

    if (xpError) throw xpError;

    // Frequency Rank (Check-ins this month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    const { data: checkins, error: checkinError } = await getSupabase()
      .from('checkins')
      .select('user_id')
      .gte('date', startOfMonthStr);

    if (checkinError) throw checkinError;

    const freqMap: Record<string, number> = {};
    checkins?.forEach(c => {
      freqMap[c.user_id] = (freqMap[c.user_id] || 0) + 1;
    });

    const freqRank = (xpRank || []).map(u => ({
      ...u,
      monthCheckinCount: freqMap[u.id] || 0
    })).sort((a, b) => (b.monthCheckinCount || 0) - (a.monthCheckinCount || 0));

    const xpRankWithFreq = (xpRank || []).map(u => ({
      ...u,
      monthCheckinCount: freqMap[u.id] || 0
    }));

    res.json({
      xpRank: xpRankWithFreq,
      freqRank: freqRank
    });
  } catch (error: any) {
    console.error('Ranking error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/admin/seed-items", async (req, res) => {
  try {
    const items = [
      { id: 'base_1', name: 'Base Masculina', slot: 'base_outfit', price: 0, image: '👤' },
      { id: 'base_2', name: 'Base Feminina', slot: 'base_outfit', price: 0, image: '👤' },
      { id: 'top_1', name: 'Camiseta CrossCity', slot: 'top', price: 50, image: '👕' },
      { id: 'top_2', name: 'Top Performance', slot: 'top', price: 75, image: '🎽' },
      { id: 'top_premium_1', name: 'Camiseta Pro Elite', slot: 'top', price: 450, image: '💎' },
      { id: 'top_premium_2', name: 'Regata HyperDry', slot: 'top', price: 380, image: '💎' },
      { id: 'bottom_1', name: 'Shorts Treino', slot: 'bottom', price: 40, image: '🩳' },
      { id: 'bottom_premium_1', name: 'Calça Tech Fleece', slot: 'bottom', price: 550, image: '💎' },
      { id: 'shoes_1', name: 'Nano X3', slot: 'shoes', price: 150, image: '👟' },
      { id: 'shoes_premium_1', name: 'Metcon 9 Pro', slot: 'shoes', price: 850, image: '💎' },
      { id: 'acc_1', name: 'Óculos de Sol', slot: 'accessory', price: 25, image: '🕶️' },
      { id: 'belt_1', name: 'Cinturão LPO', slot: 'accessory', price: 200, image: '🥋' },
      { id: 'grips_1', name: 'Grips (Couro)', slot: 'wrist_accessory', price: 120, image: '🧤' },
      { id: 'head_1', name: 'Boné CrossCity', slot: 'head_accessory', price: 30, image: '🧢' },
      { id: 'headband_1', name: 'Headband', slot: 'head_accessory', price: 45, image: '🤕' },
      { id: 'aura_1', name: 'Aura de Fogo', slot: 'special', price: 500, image: '🔥' },
    ];

    for (const item of items) {
      await getSupabase(true).from('items').upsert(item);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Seed items error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/tv-data", async (req, res) => {
  const { data: settings } = await getSupabase().from('box_settings').select('*').single();
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const { data: wod } = await getSupabase().from('wods').select('*').eq('date', today).single();
  
  const { data: checkins } = await getSupabase().from('checkins').select('*, profiles(name, avatar_equipped)').eq('date', today);
  const { data: challenges } = await getSupabase().from('challenges').select('*').eq('active', true);
  const { data: duels } = await getSupabase().from('duels').select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)').eq('status', 'accepted');
  const { data: rankings } = await getSupabase().from('profiles').select('name, xp, level, avatar_equipped').order('xp', { ascending: false }).limit(10);
  
  // Mocked stats for the ticker
  const stats = {
    frequency: "92% OPTIMAL",
    newRecord: "JULIA M. (158 REPS)",
    upcoming: "HYPERTROPHY STRENGTH"
  };

  res.json({
    settings: settings || { name: "CrossCity Hub", logo: "" },
    rewards: economy,
    wod: wod || { name: "WOD de Hoje", type: "AMRAP", warmup: "400M RUN\n20 AIR SQUATS", skill: "SNATCH FOCUS\n5 x 3 @ 65% 1RM", rx: "A definir", scaled: "A definir", beginner: "A definir" },
    checkins: checkins || [],
    challenges: challenges || [],
    duels: (duels || []).map(d => ({
      ...d,
      challengerName: (d.challenger as any)?.name,
      opponentName: (d.opponent as any)?.name
    })),
    rankings: rankings || [],
    stats
  });
});

app.get("/api/schedule", async (req, res) => {
  const { data } = await getSupabase().from('schedule').select('*').order('time');
  res.json(data || []);
});

app.get("/api/wods", async (req, res) => {
  const { data } = await getSupabase().from('wods').select('*').order('date', { ascending: false });
  res.json(data || []);
});

app.post("/api/wods", async (req, res) => {
  const { date, name, type, warmup, skill, rx, scaled, beginner } = req.body;
  const { data, error } = await getSupabase().from('wods').insert({
    date, name, type, warmup, skill, rx, scaled, beginner
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.post("/api/wods/results", async (req, res) => {
  const { userId, wodId, result, type } = req.body;
  if (!userId || !wodId || !result || !type) {
    return res.status(400).json({ message: "Dados incompletos" });
  }

  const { data, error } = await getSupabase().from('wod_results').insert({
    user_id: userId,
    wod_id: wodId,
    result,
    type,
    created_at: new Date().toISOString()
  }).select().single();

  if (error) return res.status(400).json({ message: error.message });

  // Load Reward logic from game_rules.json
  let xp = 30; // Default fallback
  let coins = 5;
  let levelUp = false;

  try {
    const rulesPath = path.join(__dirname, "src", "config", "game_rules.json");
    if (fs.existsSync(rulesPath)) {
      const rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
      const wodRewards = rules.rewards.wod_result;
      
      if (wodRewards.is_fixed) {
        xp = wodRewards.xp;
        coins = wodRewards.coins;
      } else {
        // Future logic for variable rewards could go here
        xp = wodRewards[type.toLowerCase()]?.xp || xp;
        coins = wodRewards[type.toLowerCase()]?.coins || coins;
      }
    }
  } catch (err) {
    console.error("Error loading game rules:", err);
  }

  const resultReward = await addReward(userId, 'wod_result', xp, coins, `Resultado de WOD: ${type}`);
  
  res.json({ success: true, data, xp, coins, levelUp: resultReward?.levelUp });
});

app.get("/api/wods/results/:wodId", async (req, res) => {
  const { wodId } = req.params;
  const { data, error } = await getSupabase()
    .from('wod_results')
    .select('*, profiles(name)')
    .eq('wod_id', wodId)
    .order('created_at', { ascending: false });
    
  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.get("/api/coach/results", async (req, res) => {
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const { data: wods } = await getSupabase().from('wods').select('id').eq('date', today);
  if (!wods || wods.length === 0) return res.json([]);
  
  const { data } = await getSupabase()
    .from('wod_results')
    .select('*, profiles(name)')
    .in('wod_id', wods.map(w => w.id))
    .order('created_at', { ascending: false });
    
  res.json(data || []);
});

app.get("/api/coach/athletes", async (req, res) => {
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const { data, error } = await getSupabase()
    .from('checkins')
    .select('*, profiles(*)')
    .eq('date', today);
    
  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.get("/api/user/wod-history/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await getSupabase()
    .from('wod_results')
    .select('*, wods(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  res.json(data || []);
});

app.get("/api/user/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await getSupabase().from('reward_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  res.json(data || []);
});

app.get("/api/user/prs/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await getSupabase().from('personal_records').select('*').eq('user_id', userId);
  res.json(data || []);
});

app.post("/api/user/prs", async (req, res) => {
  const { userId, exercise, value, date } = req.body;
  const { data: existing } = await getSupabase().from('personal_records').select('*').eq('user_id', userId).eq('exercise', exercise).single();
  
  if (existing) {
    await getSupabase().from('personal_records').update({ value, date }).eq('id', existing.id);
  } else {
    await getSupabase().from('personal_records').insert({ user_id: userId, exercise, value, date });
  }
  
  const { data } = await getSupabase().from('personal_records').select('*').eq('user_id', userId);
  res.json(data);
});

app.get("/api/challenges", async (req, res) => {
  const { data } = await getSupabase().from('challenges').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post("/api/challenges", async (req, res) => {
  const { title, description, active, startDate, endDate, xp, coins, repeatable, dailyLimit, difficulty } = req.body;
  const { data, error } = await getSupabase().from('challenges').insert({
    title, description, active, start_date: startDate, end_date: endDate, xp, coins, repeatable, daily_limit: dailyLimit, difficulty
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.post("/api/challenges/complete", async (req, res) => {
  const { userId, challengeId } = req.body;
  const { data: challenge } = await getSupabase().from('challenges').select('*').eq('id', challengeId).single();
  if (!challenge) return res.status(404).json({ message: "Desafio não encontrado" });
  
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  let xp = challenge.xp;
  let coins = challenge.coins;
  
  if (challenge.difficulty && economy) {
    xp = economy[`challenge_${challenge.difficulty}_xp`] || xp;
    coins = economy[`challenge_${challenge.difficulty}_coins`] || coins;
  }
  
  const result = await addReward(userId, 'challenge', xp, coins, `Desafio concluído: ${challenge.title}`);
  res.json({ success: true, xp, coins, levelUp: result?.levelUp });
});

app.post("/api/duels", async (req, res) => {
  const { challengerId, opponentId, type, reward } = req.body;
  const { data, error } = await getSupabase().from('duels').insert({
    challenger_id: challengerId,
    opponent_id: opponentId,
    type,
    reward_xp: reward.xp,
    reward_coins: reward.coins,
    status: 'pending',
    created_at: new Date().toISOString()
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.post("/api/duels/respond", async (req, res) => {
  const { duelId, status } = req.body;
  const { data, error } = await getSupabase().from('duels').update({ status }).eq('id', duelId).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.get("/api/duels/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await getSupabase()
    .from('duels')
    .select('*, challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .eq('status', 'finished')
    .order('created_at', { ascending: false });
    
  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.post("/api/duels/finish", async (req, res) => {
  const { duelId, winnerId } = req.body;
  const { data: duel } = await getSupabase().from('duels').select('*').eq('id', duelId).single();
  if (!duel) return res.status(404).json({ message: "Duelo não encontrado" });
  
  await getSupabase().from('duels').update({ status: 'finished', winner_id: winnerId }).eq('id', duelId);
  
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  const award = async (userId: string, isWinner: boolean) => {
    const xp = isWinner ? (economy?.duel_win_xp || 40) : (economy?.duel_loss_xp || 15);
    const coins = isWinner ? (economy?.duel_win_coins || 10) : 0;
    await addReward(userId, 'duel', xp, coins, isWinner ? "Vitória em duelo" : "Participação em duelo");
  };
  
  await award(duel.challenger_id, duel.challenger_id === winnerId);
  await award(duel.opponent_id, duel.opponent_id === winnerId);
  
  res.json({ success: true });
});

app.post("/api/admin/schedule", async (req, res) => {
  const { id, time, endTime, coach, capacity, days, isActive, checkinWindowMinutes } = req.body;
  if (!time || !endTime || !coach) return res.status(400).json({ message: "Dados incompletos" });
  
  const payload = { 
    time, 
    end_time: endTime, 
    coach, 
    capacity: capacity || 20,
    days: days || [1,2,3,4,5],
    is_active: isActive !== undefined ? isActive : true,
    checkin_window_minutes: checkinWindowMinutes || 60
  };

  if (id) {
    await getSupabase().from('schedule').update(payload).eq('id', id);
  } else {
    await getSupabase().from('schedule').insert(payload);
  }
  
  const { data: schedule } = await getSupabase().from('schedule').select('*').order('time');
  res.json({ success: true, schedule });
});

app.delete("/api/admin/schedule/:id", async (req, res) => {
  const { id } = req.params;
  await getSupabase().from('schedule').delete().eq('id', id);
  const { data: schedule } = await getSupabase().from('schedule').select('*').order('time');
  res.json({ success: true, schedule });
});

app.post("/api/admin/settings", async (req, res) => {
  const { 
    name, logo, description, institutionalPhoto, topBanner, 
    lat, lng, radius, tvLayout, tvConfig, 
    rewards, isActive, announcements, timezone, modules 
  } = req.body;
  
  const { data: settings } = await getSupabase().from('box_settings').select('*').single();
  const payload = {
    name,
    logo,
    description,
    institutional_photo: institutionalPhoto,
    top_banner: topBanner,
    lat,
    lng,
    radius,
    tv_layout: tvLayout,
    tv_config: tvConfig,
    timezone,
    modules,
    is_active: isActive,
    announcements,
    updated_at: new Date().toISOString()
  };

  if (settings) {
    await getSupabase().from('box_settings').update(payload).eq('id', settings.id);
  } else {
    await getSupabase().from('box_settings').insert(payload);
  }

  if (rewards) {
    const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
    if (economy) {
      await getSupabase().from('avatar_economy_settings').update(rewards).eq('id', economy.id);
    } else {
      await getSupabase().from('avatar_economy_settings').insert({ ...rewards, is_active: true });
    }
  }

  const { data: updatedSettings } = await getSupabase().from('box_settings').select('*').single();
  const { data: updatedEconomy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  const responseSettings = {
    ...updatedSettings,
    tvLayout: updatedSettings?.tv_layout,
    isActive: updatedSettings?.is_active,
    institutionalPhoto: updatedSettings?.institutional_photo,
    topBanner: updatedSettings?.top_banner,
    tvConfig: updatedSettings?.tv_config,
    modules: updatedSettings?.modules,
    rewards: updatedEconomy,
    location: { lat: updatedSettings?.lat, lng: updatedSettings?.lng }
  };
  
  res.json({ success: true, settings: responseSettings });
});

// Admin routes
app.get("/api/admin/users", async (req, res) => {
  const { data } = await getSupabase().from('profiles').select('*');
  res.json(data || []);
});

app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).single();
  if (error) return res.status(404).json({ message: "Perfil não encontrado" });
  res.json(data);
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ message: error.message });
  
  const { data: profile } = await getSupabase().from('profiles').select('*').eq('id', data.user.id).single();
  res.json(profile);
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) return res.status(400).json({ message: error.message });
  
  if (data.user) {
    const { error: profileError } = await getSupabase(true).from('profiles').insert({
      id: data.user.id,
      email,
      name,
      role: 'student',
      status: 'pending',
      xp: 0,
      coins: 0,
      level: 1
    });
    if (profileError) console.error('Error creating profile:', profileError);
  }
  
  res.json({ success: true });
});

app.post("/api/admin/users/status", async (req, res) => {
  const { userId, status, role } = req.body;
  const update: any = { status };
  if (role) update.role = role;
  
  const { data, error } = await getSupabase().from('profiles').update(update).eq('id', userId).select().single();
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

// Store Management
app.get("/api/admin/items", async (req, res) => {
  const { data } = await getSupabase().from('items').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post("/api/admin/items", async (req, res) => {
  const { id, name, slot, price, image } = req.body;
  const { data, error } = await getSupabase().from('items').upsert({ id, name, slot, price, image }).select().single();
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.delete("/api/admin/items/:id", async (req, res) => {
  const { id } = req.params;
  await getSupabase().from('items').delete().eq('id', id);
  res.json({ success: true });
});

// Duels Management
app.get("/api/admin/duels", async (req, res) => {
  const { data } = await getSupabase()
    .from('duels')
    .select('*, challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// WOD History for Admin
app.get("/api/admin/wods", async (req, res) => {
  const { data } = await getSupabase().from('wods').select('*').order('date', { ascending: false });
  res.json(data || []);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
