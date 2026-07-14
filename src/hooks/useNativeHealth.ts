// src/hooks/useNativeHealth.ts
// ============================================================================
// Ponte de Frequência Cardíaca via App de Saúde (fallback à conexão direta):
//   • iOS     → Apple HealthKit
//   • Android → Health Connect
// Usa @capgo/capacitor-health (IMPORT DINÂMICO → não afeta o build web).
// ----------------------------------------------------------------------------
// Robustez:
//   • Fluxo de autorização à prova de "undefined" (valida AuthorizationStatus).
//   • No Android, exige 'heartRate' em readAuthorized; se negado, oferece abrir
//     as configurações do Health Connect. No iOS o HealthKit oculta o status de
//     leitura por privacidade — então seguimos e validamos pela chegada de dados.
//   • Polling curto (padrão 5s) para acompanhar treinos intensos.
// ============================================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { upsertLiveHeartRate, clearLiveHeartRate } from '../lib/liveHeartRate';
import { isPlausibleBpm } from '../lib/heartRate';

// Tipos mínimos do plugin (evita acoplar o build a ele)
type HealthDataType = 'heartRate' | 'calories' | 'steps';
interface AvailabilityResult { available: boolean; platform?: string; reason?: string }
interface AuthorizationStatus {
  readAuthorized: HealthDataType[];
  readDenied: HealthDataType[];
  writeAuthorized: HealthDataType[];
  writeDenied: HealthDataType[];
}
interface HealthSample { value: number; unit?: string; startDate: string; endDate: string }
interface HealthLike {
  isAvailable(): Promise<AvailabilityResult>;
  requestAuthorization(o: { read: HealthDataType[]; write: HealthDataType[] }): Promise<AuthorizationStatus>;
  checkAuthorization?(o: { read: HealthDataType[]; write: HealthDataType[] }): Promise<AuthorizationStatus>;
  readSamples(o: {
    dataType: HealthDataType;
    startDate: string;
    endDate: string;
    limit?: number;
    ascending?: boolean;
  }): Promise<{ samples: HealthSample[] }>;
  openHealthConnectSettings?(): Promise<void>;
}

// ─── Carregador dinâmico do plugin ───────────────────────────────────────────
let _healthPromise: Promise<HealthLike> | null = null;
async function getHealth(): Promise<HealthLike> {
  if (!_healthPromise) {
    _healthPromise = import('@capgo/capacitor-health').then((m) => m.Health as unknown as HealthLike);
  }
  return _healthPromise;
}

export type NativeHealthStatus = 'idle' | 'requesting' | 'active' | 'error';

interface UseNativeHealthReturn {
  bpm: number | null;
  status: NativeHealthStatus;
  errorMessage: string | null;
  isAvailablePlatform: boolean;
  startReading: () => Promise<void>;
  stopReading: () => void;
  openSettings: () => Promise<void>;
}

const POLL_INTERVAL_MS = 5000;        // leitura a cada 5s
const LOOKBACK_MS = 10 * 60 * 1000;   // janela de 10 min (relógios sincronizam com atraso)

export function useNativeHealth(userId: string | undefined): UseNativeHealthReturn {
  const [bpm, setBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<NativeHealthStatus>('idle');
  const [errorMessage, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  const isAvailablePlatform = platform === 'ios' || platform === 'android';

  // Limpa o polling ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const syncToSupabase = useCallback(
    async (currentBpm: number) => {
      if (!userId) return;
      await upsertLiveHeartRate(userId, currentBpm, platform === 'ios' ? 'Apple Health' : 'Health Connect');
    },
    [userId, platform]
  );

  const stopReading = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setBpm(null);
    setStatus('idle');
    if (userId) {
      clearLiveHeartRate(userId).catch(() => {});
    }
  }, [userId]);

  const openSettings = useCallback(async () => {
    if (platform !== 'android') return;
    try {
      const Health = await getHealth();
      await Health.openHealthConnectSettings?.();
    } catch (e) {
      console.warn('[NativeHealth] openSettings falhou', e);
    }
  }, [platform]);

  const startReading = useCallback(async () => {
    setStatus('requesting');
    setError(null);

    if (!isAvailablePlatform) {
      setError('A leitura por app de saúde só está disponível no aplicativo instalado (Android/iOS).');
      setStatus('error');
      return;
    }

    try {
      const Health = await getHealth();

      // 1. Disponibilidade do SDK de saúde
      const availability = await Health.isAvailable().catch(() => null);
      if (!availability?.available) {
        setError(
          platform === 'ios'
            ? 'Apple Health não está disponível neste dispositivo.'
            : `Health Connect indisponível${availability?.reason ? `: ${availability.reason}` : ''}. Instale/atualize o app Health Connect.`
        );
        setStatus('error');
        return;
      }

      // 2. Autorização — FC é obrigatória; calorias/passos são opcionais
      //    (para enriquecer o resumo com dados reais do relógio, sem bloquear).
      const authOpts = {
        read: ['heartRate', 'calories', 'steps'] as HealthDataType[],
        write: [] as HealthDataType[],
      };
      let authStatus: AuthorizationStatus | null = null;
      try {
        authStatus = await Health.requestAuthorization(authOpts);
      } catch (authErr: any) {
        console.warn('[NativeHealth] requestAuthorization erro', authErr);
        // Alguns aparelhos exigem checkAuthorization após o prompt
        if (Health.checkAuthorization) {
          authStatus = await Health.checkAuthorization(authOpts).catch(() => null);
        }
      }

      // No Android conseguimos confirmar a permissão de leitura; no iOS o HealthKit
      // oculta o status por privacidade, então não bloqueamos por ele.
      if (platform === 'android') {
        const authorized = Array.isArray(authStatus?.readAuthorized)
          ? authStatus!.readAuthorized.includes('heartRate')
          : false;
        if (!authorized) {
          setError(
            'Permissão de Frequência Cardíaca negada no Health Connect. Toque em "Abrir configurações" e habilite o acesso do BoxLink.'
          );
          setStatus('error');
          return;
        }
      }

      setStatus('active');

      // 3. Polling curto — HealthKit/Health Connect não têm streaming nativo
      const poll = async () => {
        try {
          const endDate = new Date().toISOString();
          const startDate = new Date(Date.now() - LOOKBACK_MS).toISOString();

          const { samples } = await Health.readSamples({
            dataType: 'heartRate',
            startDate,
            endDate,
            limit: 1,
            ascending: false, // mais recente primeiro
          });

          if (samples && samples.length > 0) {
            // Garante a amostra mais recente por endDate
            const latest = samples.reduce((a, b) =>
              new Date(b.endDate).getTime() > new Date(a.endDate).getTime() ? b : a
            );
            const value = Math.round(latest.value ?? 0);
            if (isPlausibleBpm(value)) {
              setBpm(value);
              syncToSupabase(value);
            }
          }
        } catch (err) {
          console.warn('[NativeHealth] Erro ao ler amostra:', err);
        }
      };

      await poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    } catch (err: any) {
      console.error('[NativeHealth] Erro:', err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('denied') || msg.includes('not authorized') || msg.includes('authoriz')) {
        setError(
          platform === 'ios'
            ? 'Permissão negada. Vá em Ajustes → Saúde → Acesso a Dados → BoxLink e autorize a Frequência Cardíaca.'
            : 'Permissão negada. Abra as configurações do Health Connect e habilite o acesso do BoxLink.'
        );
      } else {
        setError(err?.message ?? 'Erro ao acessar dados de saúde.');
      }
      setStatus('error');
    }
  }, [platform, isAvailablePlatform, syncToSupabase]);

  return { bpm, status, errorMessage, isAvailablePlatform, startReading, stopReading, openSettings };
}
