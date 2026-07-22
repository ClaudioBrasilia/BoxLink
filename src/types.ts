export type UserRole = 'athlete' | 'coach' | 'admin' | 'visitor';
export type UserStatus = 'pending' | 'approved' | 'rejected';

/** allowed = acessa | blocked = vê página de bloqueio | hidden = some do menu */
export type VisitorPermissionValue = 'allowed' | 'blocked' | 'hidden';

/** Permissões por página para usuários com role 'visitor' (box_settings.visitor_permissions) */
export interface VisitorPermissions {
  feed: VisitorPermissionValue;
  wod: VisitorPermissionValue;
  leaderboard: VisitorPermissionValue;
  challenges: VisitorPermissionValue;
  clans: VisitorPermissionValue;
  mybox: VisitorPermissionValue;
  benchmarks: VisitorPermissionValue;
  duels: VisitorPermissionValue;
  progress: VisitorPermissionValue;
  avatar: VisitorPermissionValue;
}

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
  /** Raridade do item (comum | raro | epico | lendario). Define a etiqueta na loja. */
  rarity?: 'comum' | 'raro' | 'epico' | 'lendario';
  layer_adjustment?: Record<string, any> | null;
  gender_target?: 'male' | 'female' | 'both';
  /** Chave de src/lib/fitting/pieceSpecs.ts (ex.: "M-01", "F-05") usada para o encaixe automático no upload. */
  piece_spec_id?: string | null;
}

/** Tipo de conta: 'box' = vinculado a um box | 'individual' = atleta solo (BoxLink Individual) */
export type AccountType = 'box' | 'individual';

export type TrainingLogCategory = 'wod' | 'forca' | 'desafio' | 'nota';
export type TrainingFeeling = 'otimo' | 'bem' | 'normal' | 'cansado' | 'dor';

/** Registro do Diário de Treino (modo Individual) */
export interface TrainingLog {
  id: string;
  user_id: string;
  date: string;
  title: string;
  category: TrainingLogCategory;
  wod_type?: string | null;
  description?: string | null;
  result?: string | null;
  exercise?: string | null;
  load_kg?: number | null;
  rpe?: number | null;
  feeling?: TrainingFeeling | null;
  notes?: string | null;
  created_at: string;
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
  accountType?: AccountType;
  friendCode?: string | null;
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
  // NOVOS CAMPOS PARA DESAFIOS ACUMULATIVOS
  type?: 'daily_checkin' | 'accumulative'; 
  required_days?: number;      // Para daily_checkin (ex: 5 dias)
  target_value?: number;       // Para accumulative (ex: 5000)
  unit?: string;               // Para accumulative (ex: "m", "km", "reps")
  require_photo?: boolean;     // Se exige foto para completar
}

// NOVA INTERFACE PARA RASTREAR PROGRESSO ACUMULATIVO
export interface ChallengeProgress {
  id: string;
  user_id: string;
  challenge_id: string;
  progress_date: string;
  quantity: number;
  created_at: string;
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
  days: number[];
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
    tickerItems: {
      duels: boolean;
      checkins: boolean;
      topPlayer: boolean;
      wod: boolean;
      announcements: boolean;
      challenges: boolean;
    };
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
    wod_xp: number;
    wod_coins: number;
  };
  isActive: boolean;
  /** Registros antigos guardavam apenas strings; os novos são objetos Announcement. */
  announcements?: Array<string | Announcement>;
  timezone: string;
  modules: {
    economy: boolean;
    store: boolean;
    duels: boolean;
    challenges: boolean;
    clans: boolean;
  };
  clans_enabled?: boolean;
  max_clan_members?: number;
  inactivity?: {
    enabled: boolean;
    minWorkoutsPerWeek: number;
    excludeSunday: boolean;
    showOnTV: boolean;
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  active: boolean;
}
