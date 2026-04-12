export type UserRole = 'student' | 'coach' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface AvatarSlot {
  base_outfit: string;
  top: string | null;
  bottom: string | null;
  shoes: string | null;
  accessory: string | null;
  head_accessory: string | null;
  wrist_accessory: string | null;
  special: string | null;
}

export interface Item {
  id: string;
  name: string;
  slot: keyof AvatarSlot;
  price: number;
  image: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise: string;
  value: string;
  date: string;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  xp: number;
  coins: number;
  level: number;
  avatar: {
    equipped: AvatarSlot;
    inventory: string[];
  };
  checkins: { date: string; timestamp: string; classTime: string | null }[];
  paidBonuses: string[];
  createdAt: string;
  monthCheckinCount?: number;
}

export interface Wod {
  id: string;
  date: string;
  name: string;
  type: string;
  warmup: string;
  skill: string;
  rx: string;
  scaled: string;
  beginner: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  active: boolean;
  startDate: string;
  endDate: string;
  xp: number;
  coins: number;
  repeatable: boolean;
  dailyLimit: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'special';
}

export interface Duel {
  id: string;
  challengerId: string;
  opponentId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'active' | 'finished' | 'cancelled';
  winnerId?: string;
  reward: { xp: number; coins: number };
  type: string;
  createdAt: string;
}

export interface RewardEvent {
  id: string;
  userId: string;
  type: 'checkin' | 'challenge' | 'duel' | 'weekly_bonus' | 'level_up';
  xp: number;
  coins: number;
  description: string;
  createdAt: string;
}

export interface Schedule {
  id?: string;
  time: string;
  endTime: string;
  coach: string;
  capacity: number;
  days: number[]; // 0-6 (Sunday-Saturday)
  isActive: boolean;
  checkinWindowMinutes: number;
}

export interface BoxSettings {
  name: string;
  logo: string;
  description?: string;
  institutionalPhoto?: string;
  topBanner?: string;
  location: { lat: number; lng: number };
  radius: number;
  tvLayout: 'old' | 'new';
  tvConfig: {
    showCheckins: boolean;
    showRanking: boolean;
    showDuels: boolean;
    showChallenges: boolean;
    rightBlockContent: 'ranking' | 'duels' | 'challenges' | 'announcements';
    topBlockContent: 'logo' | 'wod' | 'timer';
  };
  rewards: {
    xp_per_checkin: number;
    coins_per_checkin: number;
    weekly_bonus_3_xp: number;
    weekly_bonus_3_coins: number;
    weekly_bonus_4_xp: number;
    weekly_bonus_4_coins: number;
    weekly_bonus_5_xp: number;
    weekly_bonus_5_coins: number;
    weekly_bonus_6_xp: number;
    weekly_bonus_6_coins: number;
    level_up_bonus_coins: number;
    challenge_easy_xp: number;
    challenge_easy_coins: number;
    challenge_medium_xp: number;
    challenge_medium_coins: number;
    challenge_hard_xp: number;
    challenge_hard_coins: number;
    challenge_special_xp: number;
    challenge_special_coins: number;
    duel_win_xp: number;
    duel_win_coins: number;
  };
  isActive: boolean;
  announcements?: string[];
  timezone: string;
  modules: {
    economy: boolean;
    store: boolean;
    duels: boolean;
    challenges: boolean;
  };
}
