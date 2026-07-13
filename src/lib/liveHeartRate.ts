// src/lib/liveHeartRate.ts
// ============================================================================
// Escrita do BPM ao vivo em heart_rate_live (lido pela TV do box).
// A TV usa apenas user_id, bpm e updated_at. A coluna device_name é OPCIONAL
// (só existe se a migração de Bluetooth tiver sido aplicada) — por isso, se o
// upsert com device_name falhar, reenviamos sem ela para garantir que o BPM
// SEMPRE chegue à TV.
// ============================================================================
import { supabase } from './supabase';

export async function upsertLiveHeartRate(
  userId: string,
  bpm: number,
  deviceName?: string
): Promise<void> {
  const base = { user_id: userId, bpm, updated_at: new Date().toISOString() };

  const { error } = await supabase
    .from('heart_rate_live')
    .upsert(deviceName ? { ...base, device_name: deviceName } : base, { onConflict: 'user_id' });

  if (error) {
    // Provável causa: coluna device_name ausente. Reenvia o essencial.
    const { error: retryError } = await supabase
      .from('heart_rate_live')
      .upsert(base, { onConflict: 'user_id' });
    if (retryError) console.error('[HR live] upsert falhou:', retryError.message);
  }
}

export async function clearLiveHeartRate(userId: string): Promise<void> {
  await supabase.from('heart_rate_live').delete().eq('user_id', userId);
}
