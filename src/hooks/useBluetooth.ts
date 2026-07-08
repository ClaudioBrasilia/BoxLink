// src/hooks/useBluetooth.ts
// ============================================================================
// Conexão DIRETA de Frequência Cardíaca via Bluetooth LE (baixa latência).
// Funciona em:
//   • Android/iOS nativo (Capacitor) → @capacitor-community/bluetooth-le
//   • Chrome/Edge desktop e Android → Web Bluetooth API
// Suporta UUIDs padrão + proprietários (Huawei/Xiaomi/genéricos) via catálogo
// central em src/lib/heartRate.ts, com service discovery dinâmico.
// ----------------------------------------------------------------------------
// ⚠️ O plugin nativo é carregado por IMPORT DINÂMICO — nunca é avaliado no
//    build/execução web puro, evitando quebrar Vercel/Netlify.
// ============================================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { ScanResult } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';
import {
  HEART_RATE_SERVICE,
  POLAR_PMD_SERVICE,
  WAHOO_SERVICE,
  GENERIC_SERVICES,
  OPTIONAL_SERVICES,
  parseHeartRateFallback,
  isLikelyHRDeviceName,
  isLikelyHRService,
  isLikelyHRCharacteristic,
} from '../lib/heartRate';

// ─── Carregador dinâmico do plugin nativo (só executa em plataforma nativa) ──
type BleClientType = typeof import('@capacitor-community/bluetooth-le').BleClient;
let _bleClientPromise: Promise<BleClientType> | null = null;
async function getBleClient(): Promise<BleClientType> {
  if (!_bleClientPromise) {
    _bleClientPromise = import('@capacitor-community/bluetooth-le').then((m) => m.BleClient);
  }
  return _bleClientPromise;
}

// ============================================================================
// Tipos
// ============================================================================
export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi?: number;
  hasHeartRateService: boolean;
  serviceUUIDs?: string[];
}

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

interface UseBluetoothReturn {
  isSupported: boolean;
  isNative: boolean;
  isIOSWeb: boolean;
  status: ConnectionStatus;
  error: string | null;
  devices: DiscoveredDevice[];
  connectedDevice: DiscoveredDevice | null;
  heartRate: number | null;
  scan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

// ============================================================================
// Helpers
// ============================================================================
function detectIOSWeb(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  return isIOS && !Capacitor.isNativePlatform();
}

// ============================================================================
// Hook
// ============================================================================
export function useBluetooth(userId?: string): UseBluetoothReturn {
  const isNative = Capacitor.isNativePlatform();
  const isIOSWeb = detectIOSWeb();
  // O Safari/Chrome/Edge do iPhone NÃO expõem navigator.bluetooth (Apple bloqueia
  // no WebKit). Porém navegadores como o Bluefy implementam Web Bluetooth via
  // CoreBluetooth — nesse caso navigator.bluetooth existe mesmo no iOS e devemos
  // permitir. Por isso a base do suporte é a presença REAL de navigator.bluetooth.
  const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const isSupported = isNative || hasWebBluetooth;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);

  const webDeviceRef = useRef<BluetoothDevice | null>(null);
  const webCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const nativeDeviceIdRef = useRef<string | null>(null);
  const activeSubRef = useRef<{ service: string; characteristic: string } | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const lastBpmRef = useRef<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --------------------------------------------------------------------------
  // Broadcast do BPM para o Supabase (TV ao vivo). Throttle de 5s.
  // --------------------------------------------------------------------------
  const removeFromSupabase = useCallback(() => {
    if (!userId) return;
    supabase.from('heart_rate_live').delete().eq('user_id', userId).then(() => {}, () => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (status !== 'connected') return;
    syncTimerRef.current = setInterval(() => {
      const bpm = lastBpmRef.current;
      if (!bpm) return;
      supabase
        .from('heart_rate_live')
        .upsert(
          {
            user_id: userId,
            bpm,
            device_name: connectedDevice?.name ?? 'Bluetooth',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .then(() => {}, (e) => console.error('[BLE] sync', e));
    }, 5000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    };
  }, [userId, status, connectedDevice]);

  const pushHeartRate = useCallback((bpm: number) => {
    lastBpmRef.current = bpm;
    setHeartRate(bpm);
  }, []);

  // --------------------------------------------------------------------------
  // Inicialização (nativo)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isNative) return;
    getBleClient()
      .then((Ble) => Ble.initialize({ androidNeverForLocation: true }))
      .catch((e) => console.warn('[BLE] initialize falhou', e));
  }, [isNative]);

  // --------------------------------------------------------------------------
  // SCAN
  // --------------------------------------------------------------------------
  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setStatus('scanning');

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    try {
      // Só bloqueia iOS-web quando NÃO há Web Bluetooth (Safari/Chrome/Edge do iPhone).
      // Com Bluefy (navigator.bluetooth presente), seguimos normalmente.
      if (isIOSWeb && !hasWebBluetooth) {
        throw new Error(
          'Este navegador do iPhone não suporta Bluetooth Web. Abra o BoxLink pelo navegador "Bluefy" (grátis na App Store) ou instale o app nativo.'
        );
      }

      // ---------------- NATIVO ----------------
      if (isNative) {
        const Ble = await getBleClient();
        await Ble.initialize({ androidNeverForLocation: true });
        try {
          await Ble.requestEnable();
        } catch {
          /* requestEnable pode não estar disponível */
        }

        const found = new Map<string, DiscoveredDevice>();

        await Ble.requestLEScan(
          { allowDuplicates: true }, // essencial: agrega advertising packets rotativos
          (result: ScanResult) => {
            const id = result.device.deviceId;
            const name = result.device.name || result.localName || '';

            const existing = found.get(id);
            const existingUUIDs = new Set(existing?.serviceUUIDs || []);
            (result.uuids || []).forEach((u) => existingUUIDs.add(u.toLowerCase()));

            const serviceUUIDs = Array.from(existingUUIDs);
            const hasHR =
              serviceUUIDs.some((u) => isLikelyHRService(u)) ||
              existing?.hasHeartRateService ||
              false;

            if (
              !existing ||
              (result.rssi !== undefined &&
                (existing.rssi === undefined || result.rssi > existing.rssi))
            ) {
              found.set(id, {
                id,
                name: name || `Desconhecido ${id.slice(-5)}`,
                rssi: result.rssi ?? existing?.rssi,
                hasHeartRateService: hasHR,
                serviceUUIDs,
              });
            } else if (serviceUUIDs.length > (existing.serviceUUIDs?.length || 0)) {
              found.set(id, { ...existing, serviceUUIDs, hasHeartRateService: hasHR });
            }

            const sorted = Array.from(found.values()).sort((a, b) => {
              if (a.hasHeartRateService !== b.hasHeartRateService)
                return a.hasHeartRateService ? -1 : 1;
              const aLikely = isLikelyHRDeviceName(a.name);
              const bLikely = isLikelyHRDeviceName(b.name);
              if (aLikely !== bLikely) return aLikely ? -1 : 1;
              const aHasName = a.name && !a.name.startsWith('Desconhecido');
              const bHasName = b.name && !b.name.startsWith('Desconhecido');
              if (aHasName !== bHasName) return aHasName ? -1 : 1;
              return (b.rssi ?? -999) - (a.rssi ?? -999);
            });
            setDevices(sorted);
          }
        );

        scanTimerRef.current = setTimeout(async () => {
          try {
            await Ble.stopLEScan();
          } catch {
            /* noop */
          }
          setStatus((s) => (s === 'scanning' ? 'disconnected' : s));
        }, 15000);
        return;
      }

      // ---------------- WEB ----------------
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: OPTIONAL_SERVICES as (string | number)[],
      });

      webDeviceRef.current = device;
      setDevices([
        {
          id: device.id,
          name: device.name || `Dispositivo ${device.id.slice(-5)}`,
          hasHeartRateService: true, // otimista — confirmamos ao conectar
        },
      ]);
      setStatus('disconnected');
    } catch (err: any) {
      console.error('[BLE] scan erro', err);
      const msg = err?.message || 'Erro ao escanear dispositivos';
      if (err?.name !== 'NotFoundError') setError(msg);
      setStatus(err?.name === 'NotFoundError' ? 'disconnected' : 'error');
    }
  }, [isNative, isIOSWeb]);

  const stopScan = useCallback(async () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (isNative) {
      try {
        const Ble = await getBleClient();
        await Ble.stopLEScan();
      } catch {
        /* noop */
      }
    }
    setStatus((s) => (s === 'scanning' ? 'disconnected' : s));
  }, [isNative]);

  // --------------------------------------------------------------------------
  // CONNECT — NATIVO (service discovery dinâmico)
  // --------------------------------------------------------------------------
  const connectNative = useCallback(
    async (deviceId: string): Promise<void> => {
      const Ble = await getBleClient();
      try {
        await Ble.stopLEScan();
      } catch {
        /* noop */
      }

      connectAbortRef.current = new AbortController();
      const { signal } = connectAbortRef.current;

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout ao conectar. O dispositivo pode estar fora de alcance.'));
        }, 12000);
        signal.addEventListener('abort', () => clearTimeout(timer));
      });

      const connectPromise = (async () => {
        await Ble.connect(deviceId, () => {
          console.log('[BLE] desconectado');
          setStatus('disconnected');
          setConnectedDevice(null);
          setHeartRate(null);
          lastBpmRef.current = null;
          nativeDeviceIdRef.current = null;
          activeSubRef.current = null;
          removeFromSupabase();
        });

        const services = await Ble.getServices(deviceId);
        console.log('[BLE] Serviços descobertos:', services.map((s) => s.uuid));

        // Serviços: HR padrão → proprietários prováveis → resto
        const sortedServices = [...services].sort((a, b) => {
          const aHR = a.uuid.toLowerCase() === HEART_RATE_SERVICE;
          const bHR = b.uuid.toLowerCase() === HEART_RATE_SERVICE;
          if (aHR !== bHR) return aHR ? -1 : 1;
          const aLikely = isLikelyHRService(a.uuid);
          const bLikely = isLikelyHRService(b.uuid);
          if (aLikely !== bLikely) return aLikely ? -1 : 1;
          return 0;
        });

        for (const service of sortedServices) {
          // getServices() já retorna as características embutidas em cada serviço.
          const characteristics = service.characteristics || [];
          const notifiable = characteristics.filter(
            (c) => c.properties?.notify || c.properties?.indicate
          );

          const prioritized = [...notifiable].sort((a, b) => {
            const aKnown = isLikelyHRCharacteristic(a.uuid);
            const bKnown = isLikelyHRCharacteristic(b.uuid);
            if (aKnown !== bKnown) return aKnown ? -1 : 1;
            return 0;
          });

          for (const char of prioritized) {
            try {
              await Ble.startNotifications(deviceId, service.uuid, char.uuid, (value) => {
                const bpm = parseHeartRateFallback(value);
                if (bpm !== null) pushHeartRate(bpm);
              });
              console.log(`[BLE] ✅ HR ativo em ${service.uuid} / ${char.uuid}`);
              nativeDeviceIdRef.current = deviceId;
              activeSubRef.current = { service: service.uuid, characteristic: char.uuid };
              return;
            } catch (e) {
              console.warn(`[BLE] Falha ao notificar ${service.uuid}/${char.uuid}:`, e);
            }
          }
        }

        throw new Error(
          'Dispositivo conectado mas não foi possível ativar o monitor cardíaco. ' +
            'Verifique se o dispositivo está no modo "transmissão" ou pareie primeiro em outro app.'
        );
      })();

      await Promise.race([connectPromise, timeoutPromise]);

      const dev =
        devices.find((d) => d.id === deviceId) || {
          id: deviceId,
          name: `Dispositivo ${deviceId.slice(-5)}`,
          hasHeartRateService: true,
        };
      setConnectedDevice(dev);
      setStatus('connected');
    },
    [devices, pushHeartRate, removeFromSupabase]
  );

  // --------------------------------------------------------------------------
  // CONNECT — WEB (service discovery dinâmico)
  // --------------------------------------------------------------------------
  const connectWeb = useCallback(async (): Promise<void> => {
    const device = webDeviceRef.current;
    if (!device) throw new Error('Nenhum dispositivo selecionado.');

    device.addEventListener('gattserverdisconnected', () => {
      setStatus('disconnected');
      setConnectedDevice(null);
      setHeartRate(null);
      lastBpmRef.current = null;
      webCharRef.current = null;
      removeFromSupabase();
    });

    const server = await device.gatt!.connect();

    let services: BluetoothRemoteGATTService[];
    try {
      services = await server.getPrimaryServices();
    } catch {
      services = [];
      for (const svcUUID of [HEART_RATE_SERVICE, POLAR_PMD_SERVICE, WAHOO_SERVICE, ...GENERIC_SERVICES]) {
        try {
          services.push(await server.getPrimaryService(svcUUID));
        } catch {
          /* serviço ausente */
        }
      }
    }

    services.sort((a, b) => {
      if (a.uuid.toLowerCase() === HEART_RATE_SERVICE) return -1;
      if (b.uuid.toLowerCase() === HEART_RATE_SERVICE) return 1;
      const aL = isLikelyHRService(a.uuid);
      const bL = isLikelyHRService(b.uuid);
      if (aL !== bL) return aL ? -1 : 1;
      return 0;
    });

    for (const service of services) {
      let characteristics: BluetoothRemoteGATTCharacteristic[];
      try {
        characteristics = await service.getCharacteristics();
      } catch {
        continue;
      }

      const notifiable = characteristics.filter((c) => c.properties.notify || c.properties.indicate);
      const prioritized = [...notifiable].sort((a, b) => {
        const aK = isLikelyHRCharacteristic(a.uuid);
        const bK = isLikelyHRCharacteristic(b.uuid);
        if (aK !== bK) return aK ? -1 : 1;
        return 0;
      });

      for (const char of prioritized) {
        try {
          await char.startNotifications();
          char.addEventListener('characteristicvaluechanged', (e: any) => {
            const value: DataView = e.target.value;
            const bpm = parseHeartRateFallback(value);
            if (bpm !== null) pushHeartRate(bpm);
          });
          webCharRef.current = char;
          setConnectedDevice({
            id: device.id,
            name: device.name || `Dispositivo ${device.id.slice(-5)}`,
            hasHeartRateService: true,
          });
          setStatus('connected');
          return;
        } catch {
          continue;
        }
      }
    }

    throw new Error(
      'Dispositivo conectado mas não expõe Frequência Cardíaca. Tente outro dispositivo ou ative o modo de transmissão.'
    );
  }, [pushHeartRate, removeFromSupabase]);

  // --------------------------------------------------------------------------
  // CONNECT — dispatcher
  // --------------------------------------------------------------------------
  const connect = useCallback(
    async (deviceId: string) => {
      setError(null);
      setStatus('connecting');
      try {
        if (isNative) await connectNative(deviceId);
        else await connectWeb();
      } catch (err: any) {
        console.error('[BLE] connect erro', err);
        setError(err?.name === 'AbortError' ? 'Operação cancelada.' : err?.message || 'Erro ao conectar');
        setStatus('error');
      }
    },
    [isNative, connectNative, connectWeb]
  );

  // --------------------------------------------------------------------------
  // DISCONNECT
  // --------------------------------------------------------------------------
  const disconnect = useCallback(async () => {
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;

    try {
      if (isNative && nativeDeviceIdRef.current) {
        const Ble = await getBleClient();
        const sub = activeSubRef.current;
        if (sub) {
          try {
            await Ble.stopNotifications(nativeDeviceIdRef.current, sub.service, sub.characteristic);
          } catch {
            /* noop */
          }
        }
        await Ble.disconnect(nativeDeviceIdRef.current);
        nativeDeviceIdRef.current = null;
        activeSubRef.current = null;
      } else if (webDeviceRef.current?.gatt?.connected) {
        webDeviceRef.current.gatt.disconnect();
      }
    } catch (e) {
      console.warn('[BLE] disconnect erro', e);
    }

    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    removeFromSupabase();
    lastBpmRef.current = null;
    setStatus('disconnected');
    setConnectedDevice(null);
    setHeartRate(null);
  }, [isNative, removeFromSupabase]);

  // --------------------------------------------------------------------------
  // Auto-reconexão Web (Chrome 122+)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isNative || !hasWebBluetooth) return;
    const bt: any = navigator.bluetooth;
    if (typeof bt.getDevices !== 'function') return;

    bt.getDevices()
      .then((known: BluetoothDevice[]) => {
        if (known.length > 0 && !webDeviceRef.current) {
          const last = known[0];
          webDeviceRef.current = last;
          setDevices([
            {
              id: last.id,
              name: last.name || `Dispositivo ${last.id.slice(-5)}`,
              hasHeartRateService: true,
            },
          ]);
        }
      })
      .catch(() => {});
  }, [isNative, hasWebBluetooth]);

  return {
    isSupported,
    isNative,
    isIOSWeb,
    status,
    error,
    devices,
    connectedDevice,
    heartRate,
    scan,
    stopScan,
    connect,
    disconnect,
  };
}
