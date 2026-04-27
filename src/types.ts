export type UserRole = 'athlete' | 'coach' | 'admin';
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
  avatar_equipped?: any; // Para compatibilidade com queries do banco
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
  required_days?: number;
  require_photo?: boolean;
}

export interface Duel {
  id: string;
  challengerId: string;
  opponentIds: string[];
  wodId: string | null;
  wodName: string;
  category: 'rx' | 'scaled' | 'beginner';
  results: Record<string, string | null>;
  status: 'pending' | 'accepted' | 'active' | 'finished' | 'cancelled';
  winnerId: string | null;
  betMode: boolean;
  betType: 'xp' | 'coins' | 'both' | null;
  betXpAmount: number | null;
  betCoinAmount: number | null;
  acceptedBy: string[];
  betReserved: boolean;
  betReservedAt?: number | null;
  betSettledAt?: number | null;
  betCanceledAt?: number | null;
  createdAt: string | number;
}
// ... (outras interfacesRewardEvent, Schedule, BoxSettings, etc permanecem as mesmas)
