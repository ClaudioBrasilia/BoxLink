// src/lib/heartRateSessions.ts
// ============================================================================
// Persistência do histórico de treinos de FC (resumo + gráfico completo).
// Falha graciosamente: se a tabela ainda não existir, salvar/ler vira no-op
// (não quebra o app — apenas não há histórico até rodar a migração).
// ============================================================================
import { supabase } from './supabase';
import type { HrSample } from '../hooks/useHeartRateSession';
import type { HrvPlatform, HrvSourceKind, HrvValidationStatus } from './hrvValidation';

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
  /** Campos opcionais para compatibilidade com sessões gravadas antes da HRV. */
  rr_intervals_ms?: number[] | null;
  hrv_rmssd_ms?: number | null;
  hrv_sdnn_ms?: number | null;
  hrv_metric?: 'rmssd' | 'sdnn' | null;
  hrv_at?: string | null;
  hrv_validation_status?: HrvValidationStatus | null;
  hrv_validation_reason?: string | null;
  hrv_valid_intervals?: number | null;
  hrv_total_intervals?: number | null;
  hrv_valid_ratio?: number | null;
  hrv_age_sec?: number | null;
  hrv_source_kind?: HrvSourceKind | null;
  hrv_source_name?: string | null;
  hrv_source_id?: string | null;
  hrv_platform?: HrvPlatform;
  hrv_device_id?: string | null;
}

export type NewHrSession = Omit<StoredHrSession, 'id'> & { user_id: string };

export type HrSessionQualityLevel = 'high' | 'medium' | 'low';

export interface HrSessionQuality {
  level: HrSessionQualityLevel;
  validSampleRatio: number;
  usableForWod: boolean;
  reason: string | null;
}

/**
 * Avalia se uma sessão tem qualidade mínima para ser associada automaticamente
 * a um WOD. A função é tolerante a sessões antigas sem amostras completas.
 */
export function assessHrSessionQuality(session: Pick<StoredHrSession, 'duration_sec' | 'samples'>): HrSessionQuality {
  const samples = Array.isArray(session.samples) ? session.samples : [];
  const validSamples = samples.filter(sample => Number.isFinite(sample?.bpm) && sample.bpm >= 30 && sample.bpm <= 240);
  const validSampleRatio = samples.length ? validSamples.length / samples.length : 0;
  const durationOk = Number(session.duration_sec) >= 10 * 60;
  const ratioOk = validSampleRatio >= 0.7;

  if (durationOk && ratioOk) {
    return { level: 'high', validSampleRatio, usableForWod: true, reason: null };
  }
  if (durationOk || ratioOk) {
    return {
      level: 'medium',
      validSampleRatio,
      usableForWod: false,
      reason: !durationOk ? 'Medição com menos de 10 minutos.' : 'Medição com muitas amostras inválidas.',
    };
  }
  return {
    level: 'low',
    validSampleRatio,
    usableForWod: false,
    reason: 'Medição curta e com poucas amostras válidas.',
  };
}

function isSchemaMismatch(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ['PGRST204', '42703', '42P01'].includes(error.code ?? '')
    || /column|schema cache|does not exist|could not find/i.test(error.message ?? '');
}

function withoutValidationMetadata(session: NewHrSession): Omit<NewHrSession,
  'hrv_validation_status' | 'hrv_validation_reason' | 'hrv_valid_intervals' | 'hrv_total_intervals'
  | 'hrv_valid_ratio' | 'hrv_age_sec' | 'hrv_source_kind' | 'hrv_source_name' | 'hrv_source_id'
  | 'hrv_platform' | 'hrv_device_id'
> {
  const legacy = { ...session } as Record<string, unknown>;
  delete legacy.hrv_validation_status;
  delete legacy.hrv_validation_reason;
  delete legacy.hrv_valid_intervals;
  delete legacy.hrv_total_intervals;
  delete legacy.hrv_valid_ratio;
  delete legacy.hrv_age_sec;
  delete legacy.hrv_source_kind;
  delete legacy.hrv_source_name;
  delete legacy.hrv_source_id;
  delete legacy.hrv_platform;
  delete legacy.hrv_device_id;
  return legacy as Omit<NewHrSession,
    'hrv_validation_status' | 'hrv_validation_reason' | 'hrv_valid_intervals' | 'hrv_total_intervals'
    | 'hrv_valid_ratio' | 'hrv_age_sec' | 'hrv_source_kind' | 'hrv_source_name' | 'hrv_source_id'
    | 'hrv_platform' | 'hrv_device_id'
  >;
}

export async function saveHeartRateSession(session: NewHrSession): Promise<void> {
  try {
    const { error } = await supabase.from('heart_rate_sessions').insert(session);
    if (!error) return;
    if (isSchemaMismatch(error)) {
      const legacy = withoutValidationMetadata(session);
      const retry = await supabase.from('heart_rate_sessions').insert(legacy);
      if (!retry.error) {
        console.info('[HR sessions] Sessão salva sem metadados novos; aplique a migração de validação de HRV.');
        return;
      }
      console.warn('[HR sessions] insert legado falhou:', retry.error.message);
      return;
    }
    console.warn('[HR sessions] insert falhou:', error.message);
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
export async function fetchRecentHeartRateSessions(
  userId: string,
  withinHours = 4,
  limit = 5,
): Promise<StoredHrSession[]> {
  try {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('heart_rate_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as StoredHrSession[];
  } catch {
    return [];
  }
}

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

/**
 * O vínculo é best-effort durante a transição: se a migração ainda não foi
 * aplicada no ambiente, o resultado principal continua intacto.
 */
export async function linkHeartRateSessionToWodResult(resultId: string, sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('wod_results')
      .update({ hr_session_id: sessionId })
      .eq('id', resultId);
    if (error) {
      console.warn('[HR sessions] vínculo com WOD indisponível:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[HR sessions] erro ao vincular sessão ao WOD:', e);
    return false;
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
