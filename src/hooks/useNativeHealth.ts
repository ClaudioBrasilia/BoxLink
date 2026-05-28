// src/hooks/useNativeHealth.ts
// Lê frequência cardíaca via HealthKit (iOS) e Health Connect (Android)
// Usa @capgo/capacitor-health — já listado no package.json

import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

export type HealthStatus = 'idle' | 'requesting' | 'active' | 'error' | 'unsupported';

interface UseNativeHealthReturn {
  bpm: number | null;
  status: HealthStatus;
  errorMessage: string | null;
  isNative: boolean;
  startReading: () => Promise<void>;
  stopReading: () => void;
}

export function useNativeHealth(userId: string | undefined): UseNativeHealthReturn {
  const [bpm, setBpm]                   = useState<number | null>(null);
  const [status, setStatus]             = useState<HealthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNative   = Capacitor.isNativePlatform();
  const platform   = Capacitor.getPlatform();

  const syncToSupabase = useCallback(async (currentBpm: number) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        { user_id: userId, bpm: currentBpm, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('[NativeHealth] sync error:', err);
    }
  }, [userId]);

  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try { await supabase.from('heart_rate_live').delete().eq('user_id', userId); }
    catch (err) { console.error('[NativeHealth] remove error:', err); }
  }, [userId]);

  const stopReading = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    removeFromSupabase();
    setBpm(null);
    setStatus('idle');
  }, [removeFromSupabase]);

  const startReading = useCallback(async () => {
    if (!isNative) {
      setStatus('unsupported');
      setErrorMessage('Esta função requer o app instalado no celular.');
      return;
    }
    if (!userId) {
      setErrorMessage('Você precisa estar logado.');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    try {
      // Importação dinâmica do @capgo/capacitor-health
      // Não quebra o build web (está no external do vite.config.ts)
      const { CapacitorHealthkit } = await import('@capgo/capacitor-health');

      // Solicita permissão para leitura de FC
      await CapacitorHealthkit.requestAuthorization({
        all: [],
        read: ['heartRate'],
        write: [],
      });

      setStatus('active');

      const readAndSync = async () => {
        try {
          const endDate   = new Date().toISOString();
          const startDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

          const result = await CapacitorHealthkit.queryHKitSampleType({
            sampleName: 'heartRate',
            startDate,
            endDate,
            limit: 1,
          });

          const samples = result?.resultData || [];
          if (samples.length > 0) {
            const latest   = samples[samples.length - 1];
            const currentBpm = Math.round(Number(latest.value));
            if (currentBpm > 0 && currentBpm < 250) {
              setBpm(currentBpm);
              await syncToSupabase(currentBpm);
            }
          }
        } catch (err) {
          console.error('[NativeHealth] read error:', err);
        }
      };

      await readAndSync();
      intervalRef.current = setInterval(readAndSync, 10000);

    } catch (err: any) {
      console.error('[NativeHealth] error:', err);
      setStatus('error');

      if (err.message?.includes('permission') || err.message?.includes('authorization')) {
        setErrorMessage(
          platform === 'ios'
            ? 'Permissão negada. Vá em Ajustes > Saúde > BoxLink e ative Frequência Cardíaca.'
            : 'Permissão negada. Vá em Configurações > Health Connect > BoxLink e ative Frequência Cardíaca.'
        );
      } else if (err.message?.includes('not available') || err.message?.includes('not installed')) {
        setErrorMessage(
          platform === 'android'
            ? 'Health Connect não instalado. Baixe na Play Store e tente novamente.'
            : 'HealthKit não disponível neste dispositivo.'
        );
      } else {
        setErrorMessage(err.message || 'Erro desconhecido. Tente novamente.');
      }
    }
  }, [isNative, userId, platform, syncToSupabase]);

  return { bpm, status, errorMessage, isNative, startReading, stopReading };
}
