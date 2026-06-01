// src/hooks/useBluetooth.ts
// Suporte duplo: BleClient nativo (app Android) + Web Bluetooth API (Chrome/web)
// Escolhe automaticamente o melhor método disponível.

import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

// UUIDs Padronizados Bluetooth
const HEART_RATE_SERVICE     = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE        = numberToUUID(0x180f);
const BATTERY_LEVEL          = numberToUUID(0x2a19);

// Prefixos de nome aceitos no scan nativo
const NAME_PREFIXES = [
  'Watch', 'Smart', 'Band', 'Fit', 'Heart', 'HRM', 'BT', 'ID',
  'Garmin', 'Polar', 'Wahoo', 'TICKR', 'CooSpo', 'Amazfit',
  'MiSmart', 'Mi Band', 'H',
];

// Filtros de nome para Web Bluetooth
const WEB_NAME_FILTERS = NAME_PREFIXES.map(p => ({ namePrefix: p }));

export type BluetoothStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'unsupported';

interface BluetoothDevice {
  id: string;
  name: string;
  bpm: number | null;
  battery: number | null;
  status: 'connected' | 'disconnected';
  lastUpdate: Date | null;
}

interface UseBluetoothReturn {
  devices: BluetoothDevice[];
  status: BluetoothStatus;
  errorMessage: string | null;
  isNative: boolean;
  isWebSupported: boolean;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
}

export function useBluetooth(userId: string | undefined): UseBluetoothReturn {
  const [devices, setDevices]           = useState<BluetoothDevice[]>([]);
  const [status, setStatus]             = useState<BluetoothStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const devicesRef      = useRef<Map<string, BluetoothDevice>>(new Map());
  const listenerRef     = useRef<any>(null);
  const webDeviceRef    = useRef<any>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBpmRef      = useRef<number | null>(null);

  const isNative       = Capacitor.isNativePlatform();
  const isWebSupported =
    !isNative &&
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator;

  // ─── Supabase helpers ────────────────────────────────────────────────────

  const syncToSupabase = useCallback(async (
    deviceId: string,
    bpm: number,
    deviceName: string,
  ) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        {
          user_id: userId,
          bpm,
          device_id: deviceId,
          device_name: deviceName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    } catch (err) {
      console.error('[Bluetooth] Erro ao sincronizar:', err);
    }
  }, [userId]);

  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[Bluetooth] Erro ao remover:', err);
    }
  }, [userId]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const parseHeartRate = (value: DataView): number => {
    const flags = value.getUint8(0);
    return (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
  };

  const initializeBle = useCallback(async () => {
    try {
      await BleClient.initialize();
    } catch (err) {
      console.error('[Bluetooth] Erro ao inicializar BleClient:', err);
      setErrorMessage('Bluetooth não disponível neste dispositivo');
      setStatus('unsupported');
    }
  }, []);

  const readBattery = useCallback(async (deviceId: string): Promise<number | null> => {
    try {
      const val = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
      return val.getUint8(0);
    } catch {
      return null;
    }
  }, []);

  // ─── Scan nativo (app instalado no Android) ───────────────────────────────

  const startNativeScan = useCallback(async () => {
    await initializeBle();

    // Sem filtro de serviço — relógios genéricos não anunciam o UUID
    // Heart Rate no advertisement packet, só após conectar.
    // Filtramos por nome para não listar fones, teclados, etc.
    listenerRef.current = await BleClient.requestLEScan(
      {},
      (result) => {
        const name = result.device.name || '';
        const knownName = NAME_PREFIXES.some(p =>
          name.toLowerCase().startsWith(p.toLowerCase()),
        );
        const hasHRUuid = (result as any).uuids?.includes(HEART_RATE_SERVICE) ?? false;

        if (!knownName && !hasHRUuid) return;

        const device: BluetoothDevice = {
          id: result.device.deviceId,
          name: name || `Dispositivo ${result.device.deviceId.substring(0, 8)}`,
          bpm: null,
          battery: null,
          status: 'disconnected',
          lastUpdate: null,
        };

        if (!devicesRef.current.has(result.device.deviceId)) {
          devicesRef.current.set(result.device.deviceId, device);
          setDevices(Array.from(devicesRef.current.values()));
        }
      },
    );
  }, [initializeBle]);

  // ─── Scan web (Chrome / navegador) ───────────────────────────────────────

  const connectWebDevice = useCallback(async (bleDevice: any) => {
    const device = devicesRef.current.get(bleDevice.id);
    if (!device) return;

    setStatus('connecting');

    bleDevice.addEventListener('gattserverdisconnected', () => {
      device.status = 'disconnected';
      device.bpm    = null;
      setDevices(Array.from(devicesRef.current.values()));
      setStatus('idle');
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      removeFromSupabase();
    });

    const server = await bleDevice.gatt.connect();

    let service: any;
    try {
      service = await server.getPrimaryService(HEART_RATE_SERVICE);
    } catch {
      service = await server.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
    }

    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
    await characteristic.startNotifications();

    characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
      const bpm = parseHeartRate(event.target.value);
      if (bpm > 0 && bpm < 250) {
        device.bpm        = bpm;
        device.lastUpdate = new Date();
        lastBpmRef.current = bpm;
        setDevices(Array.from(devicesRef.current.values()));
      }
    });

    device.status = 'connected';
    setStatus('connected');
    setDevices(Array.from(devicesRef.current.values()));

    syncIntervalRef.current = setInterval(() => {
      if (lastBpmRef.current !== null) {
        syncToSupabase(bleDevice.id, lastBpmRef.current, device.name);
      }
    }, 3000);
  }, [removeFromSupabase, syncToSupabase]);

  const startWebScan = useCallback(async () => {
    const nav = navigator as any;

    const bleDevice = await nav.bluetooth.requestDevice({
      filters: [
        { services: [HEART_RATE_SERVICE] },
        ...WEB_NAME_FILTERS,
      ],
      optionalServices: [
        HEART_RATE_SERVICE,
        BATTERY_SERVICE,
        '00001800-0000-1000-8000-00805f9b34fb',
        '00001801-0000-1000-8000-00805f9b34fb',
      ],
    });

    webDeviceRef.current = bleDevice;

    const device: BluetoothDevice = {
      id: bleDevice.id,
      name: bleDevice.name || 'Dispositivo',
      bpm: null,
      battery: null,
      status: 'disconnected',
      lastUpdate: null,
    };

    devicesRef.current.set(bleDevice.id, device);
    setDevices(Array.from(devicesRef.current.values()));

    await connectWebDevice(bleDevice);
  }, [connectWebDevice]);

  // ─── Conectar via nativo (BleClient) ─────────────────────────────────────

  const connectNativeDevice = useCallback(async (deviceId: string) => {
    const device = devicesRef.current.get(deviceId);
    if (!device) return;

    setStatus('connecting');

    await BleClient.connect(deviceId, (id) => {
      const dev = devicesRef.current.get(id);
      if (dev) {
        dev.status = 'disconnected';
        setDevices(Array.from(devicesRef.current.values()));
      }
    });

    await BleClient.discoverServices(deviceId);

    const battery = await readBattery(deviceId);
    if (battery !== null) device.battery = battery;

    await BleClient.startNotifications(
      deviceId,
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (value) => {
        const bpm = parseHeartRate(value);
        device.bpm        = bpm;
        device.lastUpdate = new Date();
        setDevices(Array.from(devicesRef.current.values()));
        syncToSupabase(deviceId, bpm, device.name);
      },
    );

    device.status = 'connected';
    setStatus('connected');
    setDevices(Array.from(devicesRef.current.values()));
  }, [readBattery, syncToSupabase]);

  // ─── API pública ──────────────────────────────────────────────────────────

  const startScanning = useCallback(async () => {
    try {
      setStatus('scanning');
      setErrorMessage(null);

      if (isNative) {
        await startNativeScan();
      } else if (isWebSupported) {
        await startWebScan();
      } else {
        setStatus('unsupported');
        setErrorMessage('Bluetooth não disponível. Use o app instalado ou Chrome.');
      }
    } catch (err: any) {
      if (
        err.name === 'NotFoundError' ||
        err.message?.includes('cancelled') ||
        err.message?.includes('User cancelled')
      ) {
        setStatus('idle');
        return;
      }
      console.error('[Bluetooth] Erro ao escanear:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro ao iniciar busca');
    }
  }, [isNative, isWebSupported, startNativeScan, startWebScan]);

  const connectDevice = useCallback(async (deviceId: string) => {
    try {
      if (isNative) {
        await connectNativeDevice(deviceId);
      } else {
        if (webDeviceRef.current?.id === deviceId) {
          await connectWebDevice(webDeviceRef.current);
        }
      }
    } catch (err: any) {
      console.error('[Bluetooth] Erro ao conectar:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro ao conectar');
    }
  }, [isNative, connectNativeDevice, connectWebDevice]);

  const disconnectDevice = useCallback(async (deviceId: string) => {
    try {
      if (isNative) {
        await BleClient.stopNotifications(deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
        await BleClient.disconnect(deviceId);
      } else {
        if (webDeviceRef.current?.gatt?.connected) {
          webDeviceRef.current.gatt.disconnect();
        }
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      }
      const device = devicesRef.current.get(deviceId);
      if (device) {
        device.status = 'disconnected';
        device.bpm    = null;
        setDevices(Array.from(devicesRef.current.values()));
      }
    } catch (err) {
      console.error('[Bluetooth] Erro ao desconectar:', err);
    }
  }, [isNative]);

  const stopScanning = useCallback(async () => {
    try {
      if (isNative) await BleClient.stopLEScan();
      setStatus('idle');
    } catch (err) {
      console.error('[Bluetooth] Erro ao parar scan:', err);
    }
  }, [isNative]);

  const disconnectAll = useCallback(async () => {
    for (const [deviceId] of devicesRef.current) {
      await disconnectDevice(deviceId);
    }
    removeFromSupabase();
    setStatus('idle');
  }, [disconnectDevice, removeFromSupabase]);

  useEffect(() => {
    return () => { disconnectAll(); };
  }, [disconnectAll]);

  return {
    devices,
    status,
    errorMessage,
    isNative,
    isWebSupported,
    startScanning,
    stopScanning,
    connectDevice,
    disconnectDevice,
    disconnectAll,
  };
}
