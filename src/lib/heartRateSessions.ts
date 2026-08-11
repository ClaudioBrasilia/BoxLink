// src/lib/heartRateSessions.ts
// ============================================================================
// Persistência do histórico de treinos de FC (resumo + gráfico completo).
// Falha graciosamente: se a tabela ainda não existir, salvar/ler vira no-op
// (não quebra o app — apenas não há histórico até rodar a migração).
// ============================================================================
import { supabase } from './supabase';
import type { HrSample } from '../hooks/useHeartRateSession';

export interface StoredHrSession {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number;
  avg_bpm: number;
  max_bpm: number;
  min_bpm: number;
  effort: number;
  calories: number | null;
  calories_source: 'device' | 'estimate' | null;
  steps: number | null;
  zone_secs: number[];
  dominant_zone: number;
  samples: HrSample[];
  device_name: string | null;
  source: 'ble' | 'health' | null;
}

export type NewHrSession = Omit<StoredHrSession, 'id'> & { user_id: string };

export async function saveHeartRateSession(session: NewHrSession): Promise<void> {
  try {
    const { error } = await supabase.from('heart_rate_sessions').insert(session);
    if (error) console.warn('[HR sessions] insert falhou:', error.message);
  } catch (e) {
    console.warn('[HR sessions] insert erro:', e);
  }
}

export async function fetchHeartRateSessions(
  userId: string,
  limit = 30
): Promise<StoredHrSession[]> {
  try {
    const { data, error } = await supabase
      .from('heart_rate_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as StoredHrSession[];
  } catch {
    return [];
  }
}

/**
 * A última sessão de FC do atleta dentro de uma janela de horas — é o que o
 * Box anexa ao resultado do WOD como esforço do treino.
 *
 * A janela existe pra não grudar a corrida da manhã no WOD da noite: fora
 * dela, o resultado simplesmente vai sem esforço. Quatro horas cobrem com
 * folga "medi a FC, tomei banho e registrei o resultado" sem alcançar outro
 * treino do mesmo dia.
 */
export async function fetchRecentHeartRateSession(
  userId: string,
  withinHours = 4,
): Promise<StoredHrSession | null> {
  try {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('heart_rate_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as StoredHrSession;
  } catch {
    return null;
  }
}

export async function deleteHeartRateSession(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('heart_rate_sessions').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
