// src/hooks/useNativeHealth.ts
// Lê frequência cardíaca via HealthKit (iOS) e Health Connect (Android)
// Funciona com QUALQUER relógio que sincronize com o celular

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
  const [bpm, setBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<HealthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Só funciona em app nativo (Android/iOS)
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

  const syncToSupabase = useCallback(async (currentBpm: number) => {
    if (!userId) return;
    try {
      await supabase
        .from('heart_rate_live')
        .upsert(
          { user_id: userId, bpm: currentBpm, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.error('[NativeHealth] Erro ao sincronizar:', err);
    }
  }, [userId]);

  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[NativeHealth] Erro ao remover:', err);
    }
  }, [userId]);

  const stopReading = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
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
      // Importa o plugin dinamicamente (só disponível no app nativo)
      const { Health } = await import('@capacitor-community/health');

      // Solicita permissão para ler FC
      await Health.requestAuthorization({
        read: ['heart_rate'],
        write: [],
      });

      setStatus('active');

      // Lê a FC a cada 10 segundos
      const readAndSync = async () => {
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 5 * 60 * 1000); // últimos 5 min

          const result = await Health.query({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            dataType: 'heart_rate',
            limit: 1,
          });

          if (result.values && result.values.length > 0) {
            // Pega o valor mais recente
            const latest = result.values[result.values.length - 1];
            const currentBpm = Math.round(Number(latest.value));

            if (currentBpm > 0 && currentBpm < 250) {
              setBpm(currentBpm);
              await syncToSupabase(currentBpm);
            }
          }
        } catch (err) {
          console.error('[NativeHealth] Erro ao ler FC:', err);
        }
      };

      // Lê imediatamente e depois a cada 10 segundos
      await readAndSync();
      intervalRef.current = setInterval(readAndSync, 10000);

    } catch (err: any) {
      console.error('[NativeHealth] Erro:', err);
      setStatus('error');

      if (err.message?.includes('permission') || err.message?.includes('authorization')) {
        setErrorMessage(
          platform === 'ios'
            ? 'Permissão negada. Vá em Ajustes > Saúde > BoxLink e ative Frequência Cardíaca.'
            : 'Permissão negada. Vá em Configurações > Health Connect > BoxLink e ative Frequência Cardíaca.'
        );
      } else if (err.message?.includes('not available')) {
        setErrorMessage(
          platform === 'android'
            ? 'Health Connect não instalado. Baixe na Play Store.'
            : 'HealthKit não disponível neste dispositivo.'
        );
      } else {
        setErrorMessage(err.message || 'Erro desconhecido.');
      }
    }
  }, [isNative, userId, platform, syncToSupabase]);

  return { bpm, status, errorMessage, isNative, startReading, stopReading };
}
