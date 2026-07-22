// src/lib/plan.ts
// Fonte única do que é grátis x premium no BoxLink Individual.
// Para lançar um recurso premium, ajuste os limites aqui e use os helpers no app —
// nenhuma regra de plano deve ficar espalhada pelas telas.

import { User } from '../types';

export type PlanTier = 'free' | 'premium';

export interface PlanLimits {
  /** Máximo de amigos que podem ser convidados para o MESMO duelo */
  maxDuelFriends: number;
  /** Dias de histórico do diário visíveis (Infinity = ilimitado) */
  diaryHistoryDays: number;
  /** Acesso à liga / ranking de atletas individuais */
  leagueRanking: boolean;
  /** Pode escolher um código de atleta personalizado (vanity) */
  customFriendCode: boolean;
  /** Duelos ativos simultâneos (Infinity = ilimitado) */
  maxActiveDuels: number;
  /** Insights (sono/RPE × desempenho, evolução de carga avançada) */
  advancedInsights: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxDuelFriends: 1,
    diaryHistoryDays: 30,
    leagueRanking: false,
    customFriendCode: false,
    maxActiveDuels: 1,
    advancedInsights: false,
  },
  premium: {
    maxDuelFriends: 8,
    diaryHistoryDays: Infinity,
    leagueRanking: true,
    customFriendCode: true,
    maxActiveDuels: Infinity,
    advancedInsights: true,
  },
};

/** Assinatura premium ativa (respeita a validade, se houver) */
export function isPremium(user?: Pick<User, 'plan' | 'planExpiresAt'> | null): boolean {
  if (!user || user.plan !== 'premium') return false;
  if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() < Date.now()) return false;
  return true;
}

/** Limites efetivos do usuário conforme o plano atual */
export function planLimits(user?: Pick<User, 'plan' | 'planExpiresAt'> | null): PlanLimits {
  return isPremium(user) ? PLAN_LIMITS.premium : PLAN_LIMITS.free;
}
