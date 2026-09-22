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

/** Compatibilidade com ambientes que ainda só têm a tabela base de FC. */
function withoutHrvMetadata(session: NewHrSession): Omit<NewHrSession,
  'rr_intervals_ms' | 'hrv_rmssd_ms' | 'hrv_sdnn_ms' | 'hrv_metric' | 'hrv_at'
  | 'hrv_validation_status' | 'hrv_validation_reason' | 'hrv_valid_intervals' | 'hrv_total_intervals'
  | 'hrv_valid_ratio' | 'hrv_age_sec' | 'hrv_source_kind' | 'hrv_source_name' | 'hrv_source_id'
  | 'hrv_platform' | 'hrv_device_id'
> {
  const legacy = { ...session } as Record<string, unknown>;
  for (const key of [
    'rr_intervals_ms', 'hrv_rmssd_ms', 'hrv_sdnn_ms', 'hrv_metric', 'hrv_at',
    'hrv_validation_status', 'hrv_validation_reason', 'hrv_valid_intervals', 'hrv_total_intervals',
    'hrv_valid_ratio', 'hrv_age_sec', 'hrv_source_kind', 'hrv_source_name', 'hrv_source_id',
    'hrv_platform', 'hrv_device_id',
  ]) delete legacy[key];
  return legacy as Omit<NewHrSession,
    'rr_intervals_ms' | 'hrv_rmssd_ms' | 'hrv_sdnn_ms' | 'hrv_metric' | 'hrv_at'
    | 'hrv_validation_status' | 'hrv_validation_reason' | 'hrv_valid_intervals' | 'hrv_total_intervals'
    | 'hrv_valid_ratio' | 'hrv_age_sec' | 'hrv_source_kind' | 'hrv_source_name' | 'hrv_source_id'
    | 'hrv_platform' | 'hrv_device_id'
  >;
}

export interface HrSessionSaveResult {
  ok: boolean;
  /** true quando a sessão já havia sido gravada por outro caminho. */
  deduped?: boolean;
  error?: string;
}

/**
 * Falhas que valem uma nova tentativa: rede caindo, timeout, 5xx. Erros de
 * schema ou de permissão são determinísticos — repetir só atrasaria o aviso.
 */
function isRetriableSaveError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (isSchemaMismatch(error)) return false;
  const msg = error.message ?? '';
  if (/permission|denied|violates row-level security|jwt|not authorized/i.test(msg)) return false;
  return /fetch|network|timeout|abort|connection|temporarily|unavailable|5\d\d/i.test(msg)
    || error.code === '' || error.code == null;
}

const SAVE_RETRY_DELAYS_MS = [1000, 3000, 7000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function insertSession(session: NewHrSession): Promise<{ ok: boolean; error: string | null; retriable: boolean }> {
  const { error } = await supabase.from('heart_rate_sessions').insert(session);
  if (!error) return { ok: true, error: null, retriable: false };
  if (isSchemaMismatch(error)) {
    const legacy = withoutValidationMetadata(session);
    const retry = await supabase.from('heart_rate_sessions').insert(legacy);
    if (!retry.error) {
      console.info('[HR sessions] Sessão salva sem metadados novos; aplique a migração de validação de HRV.');
      return { ok: true, error: null, retriable: false };
    }
    if (isSchemaMismatch(retry.error)) {
      const base = withoutHrvMetadata(session);
      const baseRetry = await supabase.from('heart_rate_sessions').insert(base);
      if (!baseRetry.error) {
        console.info('[HR sessions] Sessão salva sem colunas de HRV; aplique as migrações de HRV.');
        return { ok: true, error: null, retriable: false };
      }
      return { ok: false, error: baseRetry.error.message, retriable: isRetriableSaveError(baseRetry.error) };
    }
    return { ok: false, error: retry.error.message, retriable: isRetriableSaveError(retry.error) };
  }
  return { ok: false, error: error.message, retriable: isRetriableSaveError(error) };
}

/**
 * Grava o treino no histórico. Nunca lança — devolve o resultado para quem
 * chamou poder avisar o atleta. Tenta de novo em falha de rede: num celular
 * dentro da academia, uma queda momentânea de sinal não pode custar o treino.
 */
export async function saveHeartRateSession(session: NewHrSession): Promise<HrSessionSaveResult> {
  let lastError = 'Erro desconhecido ao salvar.';
  for (let attempt = 0; attempt <= SAVE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await insertSession(session);
      if (result.ok) return { ok: true };
      lastError = result.error ?? lastError;
      if (!result.retriable) break;
    } catch (e) {
      lastError = String((e as any)?.message || e);
    }
    if (attempt < SAVE_RETRY_DELAYS_MS.length) await sleep(SAVE_RETRY_DELAYS_MS[attempt]);
  }
  console.warn('[HR sessions] insert falhou:', lastError);
  return { ok: false, error: lastError };
}

// ─── Trava de gravação única ────────────────────────────────────────────────
// A mesma sessão pode ser oferecida por dois caminhos: o widget, assim que ela
// encerra, e a tela de resumo, se o atleta chegar nela. Quem chegar primeiro
// grava; o segundo vira no-op. Sem isto o treino entraria duplicado no
// histórico agora que a gravação não depende mais da tela.
const inFlightSaves = new Map<string, Promise<HrSessionSaveResult>>();
const savedKeys = new Set<string>();

/** Identidade da sessão: mesmo atleta + mesmo instante de início. */
export function hrSessionKey(userId: string, startedAtMs: number | null): string {
  return `${userId}|${startedAtMs ?? 'sem-inicio'}`;
}

export async function saveHeartRateSessionOnce(
  key: string,
  session: NewHrSession,
): Promise<HrSessionSaveResult> {
  if (savedKeys.has(key)) return { ok: true, deduped: true };
  const running = inFlightSaves.get(key);
  if (running) return running;

  const pending = saveHeartRateSession(session).then((result) => {
    if (result.ok) savedKeys.add(key);
    inFlightSaves.delete(key);
    return result;
  });
  inFlightSaves.set(key, pending);
  return pending;
}

/** Usado nos testes para isolar o estado da trava entre casos. */
export function resetHrSessionSaveGuard(): void {
  inFlightSaves.clear();
  savedKeys.clear();
}

export async function fetchHeartRateSessions(
  userId: string,
  limit = 30
): Promise<StoredHrSession[]> {
  const result = await fetchHeartRateSessionsDetailed(userId, limit);
  return result.sessions;
}

export interface HrSessionFetchResult {
  sessions: StoredHrSession[];
  error: string | null;
}

/** Consulta detalhada usada pelo Perfil para não mascarar erro como lista vazia. */
export async function fetchHeartRateSessionsDetailed(
  userId: string,
  limit = 30
): Promise<HrSessionFetchResult> {
  try {
    const { data, error } = await supabase
      .from('heart_rate_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { sessions: [], error: error.message };
    if (!data) return { sessions: [], error: 'O Supabase não retornou dados.' };
    return { sessions: data as StoredHrSession[], error: null };
  } catch (e) {
    return { sessions: [], error: String((e as any)?.message || e) };
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
