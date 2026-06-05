// src/hooks/useNativeHealth.ts
// Lê FC via HealthKit (iOS) ou Health Connect (Android)
// Usa o plugin @capgo/capacitor-health que já está no package.json do projeto

import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { supabase } from '../lib/supabase';

export type NativeHealthStatus = 'idle' | 'requesting' | 'active' | 'error';

interface UseNativeHealthReturn {
  bpm: number | null;
  status: NativeHealthStatus;
  errorMessage: string | null;
  startReading: () => Promise<void>;
  stopReading: () => void;
}

export function useNativeHealth(userId: string | undefined): UseNativeHealthReturn {
  const [bpm, setBpm]            = useState<number | null>(null);
  const [status, setStatus]      = useState<NativeHealthStatus>('idle');
  const [errorMessage, setError] = useState<string | null>(null);
  const intervalRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const platform                 = Capacitor.getPlatform(); // 'ios' | 'android'

  const syncToSupabase = useCallback(async (currentBpm: number) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        {
          user_id: userId,
          bpm: currentBpm,
          device_name: platform === 'ios' ? 'Apple Health' : 'Health Connect',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (err) { console.error('[NativeHealth] Sync error:', err); }
  }, [userId, platform]);

  const stopReading = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setBpm(null);
    setStatus('idle');
    if (userId) {
      supabase.from('heart_rate_live').delete().eq('user_id', userId).then(() => {});
    }
  }, [userId]);

  const startReading = useCallback(async () => {
    setStatus('requesting');
    setError(null);

    try {
      // 1. Verificar se o SDK de saúde está disponível no dispositivo
      const { available, reason } = await Health.isAvailable();
      if (!available) {
        setError(
          platform === 'ios'
            ? 'Apple Health não está disponível neste dispositivo.'
            : `Health Connect não disponível: ${reason ?? 'instale o app Health Connect'}`
        );
        setStatus('error');
        return;
      }

      // 2. Solicitar permissão de leitura de frequência cardíaca
      await Health.requestAuthorization({
        read: ['heartRate'],
        write: [],
      });

      setStatus('active');

      // 3. Polling a cada 5 segundos — HealthKit/Health Connect não tem streaming nativo
      // O relógio sincroniza dados periodicamente, então polling é a abordagem correta
      const poll = async () => {
        try {
          const endDate   = new Date().toISOString();
          const startDate = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // últimos 2 min

          const { samples } = await Health.readSamples({
            dataType: 'heartRate',
            startDate,
            endDate,
            limit: 1,
          });

          if (samples && samples.length > 0) {
            // O valor vem em BPM (unidade padrão do plugin para heartRate)
            const latestBpm = Math.round(samples[0].value ?? 0);
            if (latestBpm > 30 && latestBpm < 250) {
              setBpm(latestBpm);
              syncToSupabase(latestBpm);
            }
          }
        } catch (err) {
          console.warn('[NativeHealth] Erro ao ler amostra:', err);
        }
      };

      // Leitura imediata + polling
      await poll();
      intervalRef.current = setInterval(poll, 5000);

    } catch (err: any) {
      console.error('[NativeHealth] Erro:', err);

      // Tratamento específico para permissão negada
      if (err?.message?.toLowerCase().includes('denied') || err?.message?.toLowerCase().includes('not authorized')) {
        setError(
          platform === 'ios'
            ? 'Permissão negada. Vá em Ajustes → Saúde → BoxLink e autorize a leitura.'
            : 'Permissão negada. Verifique as permissões do Health Connect.'
        );
      } else {
        setError(err?.message ?? 'Erro ao acessar dados de saúde.');
      }
      setStatus('error');
    }
  }, [platform, syncToSupabase]);

  return { bpm, status, errorMessage, startReading, stopReading };
}
