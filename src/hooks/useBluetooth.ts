// src/hooks/useBluetooth.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

// UUIDs Bluetooth SIG
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = numberToUUID(0x180f);
const BATTERY_LEVEL = numberToUUID(0x2a19);

// Dispositivos prioritários (relógios)
const PRIORITY_DEVICES = [
  'apple watch', 'galaxy watch', 'fitbit', 'garmin',
  'polar', 'withings', 'amazfit', 'huawei', 'xiaomi'
];

export type BluetoothStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error' | 'unsupported';

export interface BluetoothDevice {
  id: string;
  name: string;
  bpm: number | null;
  battery: number | null;
  status: 'connected' | 'disconnected';
  lastUpdate: Date | null;
  isPriority?: boolean;
  _webDevice?: any;
}

interface UseBluetoothReturn {
  devices: BluetoothDevice[];
  status: BluetoothStatus;
  errorMessage: string | null;
  isNative: boolean;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
}

export function useBluetooth(userId: string | undefined): UseBluetoothReturn {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [status, setStatus] = useState<BluetoothStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const devicesRef = useRef<Map<string, BluetoothDevice>>(new Map());
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // ✅ CORRIGIDO: usando @capgo/capacitor-health (já instalado no package.json)
  // Import dinâmico e seguro — só carrega em iOS nativo, nunca no build web
  const healthKitRef = useRef<any>(null);

  useEffect(() => {
    if (isNative && platform === 'ios') {
      import('@capgo/capacitor-health')
        .then(mod => {
          healthKitRef.current = mod.CapacitorHealth ?? mod.default ?? mod;
          console.log('[HealthKit] Módulo carregado:', healthKitRef.current);
        })
        .catch(err => console.warn('[HealthKit] Não disponível:', err));
    }
  }, [isNative, platform]);

  // Verifica se é relógio prioritário
  const isPriorityDevice = (name: string) => (
    PRIORITY_DEVICES.some(keyword => name.toLowerCase().includes(keyword))
  );

  // Sincroniza com Supabase
  const syncToSupabase = useCallback(async (deviceId: string, bpm: number, deviceName: string) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        { user_id: userId, bpm, device_id: deviceId, device_name: deviceName },
        { onConflict: 'user_id' }
      );
    } catch (err) { console.error('[Supabase] Erro:', err); }
  }, [userId]);

  // Remove dados do Supabase
  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').delete().eq('user_id', userId);
    } catch (err) { console.error('[Supabase] Erro ao remover:', err); }
  }, [userId]);

  // Inicializa Bluetooth (Somente Nativo)
  const initializeBle = useCallback(async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      // ✅ Solicita autorização do HealthKit apenas se disponível no iOS
      if (isNative && platform === 'ios' && healthKitRef.current) {
        try {
          await healthKitRef.current.requestAuthorization({
            read: ['heartRate'],
            write: []
          });
        } catch (hkErr) {
          console.warn('[HealthKit] Erro ao solicitar autorização:', hkErr);
        }
      }
    } catch (err) {
      console.error('[Bluetooth] Erro:', err);
      setStatus('unsupported');
      setErrorMessage('Dispositivo não compatível');
      throw err;
    }
  }, [isNative, platform]);

  // Conecta dispositivo
  const connectDevice = useCallback(async (deviceId: string) => {
    const device = devicesRef.current.get(deviceId);
    if (!device) return;

    setStatus('connecting');

    // ==== CONEXÃO WEB (Navegador) ====
    if (!isNative) {
      try {
        const webDevice = device._webDevice;
        if (!webDevice) throw new Error('Dispositivo Web não encontrado');

        const server = await webDevice.gatt.connect();

        try {
          const batteryService = await server.getPrimaryService('battery_service');
          const batteryChar = await batteryService.getCharacteristic('battery_level');
          const batteryValue = await batteryChar.readValue();
          device.battery = batteryValue.getUint8(0);
        } catch {
          console.log('[Web Bluetooth] Sem serviço de bateria');
        }

        const heartRateService = await server.getPrimaryService(HEART_RATE_SERVICE);
        const heartRateChar = await heartRateService.getCharacteristic(HEART_RATE_MEASUREMENT);

        await heartRateChar.startNotifications();
        heartRateChar.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value;
          const flags = value.getUint8(0);
          const bpm = (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
          device.bpm = bpm;
          device.lastUpdate = new Date();
          setDevices(Array.from(devicesRef.current.values()));
          syncToSupabase(deviceId, bpm, device.name);
        });

        webDevice.addEventListener('gattserverdisconnected', () => {
          device.status = 'disconnected';
          device.bpm = null;
          setDevices(Array.from(devicesRef.current.values()));
        });

        device.status = 'connected';
        setStatus('connected');
      } catch (err: any) {
        console.error('[Web Conexão] Erro:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Erro ao conectar via Web');
      }
      return;
    }

    // ==== CONEXÃO NATIVA (App Celular) ====
    try {
      await BleClient.connect(deviceId);
      await BleClient.discoverServices(deviceId);

      try {
        const battery = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
        device.battery = battery.getUint8(0);
      } catch { /* sem bateria */ }

      await BleClient.startNotifications(
        deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT,
        (value) => {
          const flags = value.getUint8(0);
          const bpm = (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
          device.bpm = bpm;
          device.lastUpdate = new Date();
          setDevices(Array.from(devicesRef.current.values()));
          syncToSupabase(deviceId, bpm, device.name);
        }
      );

      device.status = 'connected';
      setStatus('connected');
    } catch (err: any) {
      console.error('[Conexão] Erro:', err);
      setStatus('error');
      setErrorMessage(
        platform === 'ios' ? 'Conecte via HealthKit (Apple Watch)' : err.message
      );
    }
  }, [syncToSupabase, platform, isNative]);

  // Desconecta dispositivo
  const disconnectDevice = useCallback(async (deviceId: string) => {
    try {
      const device = devicesRef.current.get(deviceId);

      if (!isNative) {
        if (device?._webDevice?.gatt?.connected) {
          device._webDevice.gatt.disconnect();
        }
      } else {
        await BleClient.stopNotifications(deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
        await BleClient.disconnect(deviceId);
      }

      if (device) {
        device.status = 'disconnected';
        device.bpm = null;
        setDevices(Array.from(devicesRef.current.values()));
      }
    } catch (err) { console.error('[Bluetooth] Erro ao desconectar:', err); }
  }, [isNative]);

  // Desconecta todos
  const disconnectAll = useCallback(async () => {
    for (const [deviceId] of devicesRef.current) {
      await disconnectDevice(deviceId);
    }
    removeFromSupabase();
    setStatus('idle');
  }, [disconnectDevice, removeFromSupabase]);

  // Para escaneamento
  const stopScanning = useCallback(async () => {
    try {
      if (isNative) await BleClient.stopLEScan();
      if (status === 'scanning') setStatus('idle');
    } catch (err) { console.error('[Bluetooth] Erro ao parar scan:', err); }
  }, [status, isNative]);

  // Inicia escaneamento
  const startScanning = useCallback(async () => {
    setStatus('scanning');
    setErrorMessage(null);

    // ==== SCANNER WEB (Navegador) ====
    if (!isNative) {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        setErrorMessage('Seu navegador não suporta Bluetooth. Use o Google Chrome no Android ou Computador.');
        setStatus('unsupported');
        return;
      }

      try {
        const webDevice = await nav.bluetooth.requestDevice({
          filters: [{ services: [HEART_RATE_SERVICE] }],
          optionalServices: ['battery_service']
        });

        const deviceId = webDevice.id;
        const name = webDevice.name || 'Dispositivo Web';
        const isPriority = isPriorityDevice(name);

        const device: BluetoothDevice = {
          id: deviceId,
          name,
          bpm: null,
          battery: null,
          status: 'disconnected',
          lastUpdate: null,
          isPriority,
          _webDevice: webDevice
        };

        devicesRef.current.set(deviceId, device);
        setDevices(Array.from(devicesRef.current.values()));
        setStatus('idle');
      } catch (err: any) {
        console.error('[Web Scan] Erro:', err);
        setStatus('error');
        setErrorMessage(
          err.name === 'NotFoundError'
            ? 'Busca cancelada ou nenhum dispositivo encontrado.'
            : 'Erro ao acessar o Bluetooth pelo navegador.'
        );
      }
      return;
    }

    // ==== SCANNER NATIVO (Capacitor App) ====
    devicesRef.current.clear();
    setDevices([]);

    try {
      await initializeBle();

      const onResult = (result: any) => {
        const name = result.device.name || '';
        const deviceId = result.device.deviceId;
        const isPriority = isPriorityDevice(name);
        const hasHeartRate = result.uuids?.includes(HEART_RATE_SERVICE);

        if (!hasHeartRate && !isPriority) return;

        const device: BluetoothDevice = {
          id: deviceId,
          name: name || `Dispositivo ${deviceId.slice(-4)}`,
          bpm: null,
          battery: null,
          status: 'disconnected',
          lastUpdate: null,
          isPriority
        };

        if (!devicesRef.current.has(deviceId)) {
          devicesRef.current.set(deviceId, device);
          setDevices(Array.from(devicesRef.current.values()));
        }
      };

      await BleClient.requestLEScan(
        platform === 'ios' ? { services: [HEART_RATE_SERVICE] } : {},
        onResult
      );

      setTimeout(() => stopScanning(), 30000);
    } catch (err: any) {
      console.error('[Scan] Erro:', err);
      setStatus('error');
      setErrorMessage(
        platform === 'android' ? 'Ative Bluetooth e Localização' : 'Permita acesso ao HealthKit'
      );
    }
  }, [isNative, platform, initializeBle, stopScanning]);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => { disconnectAll(); };
  }, [disconnectAll]);

  return {
    devices: Array.from(devicesRef.current.values()).sort((a, b) =>
      (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0)
    ),
    status,
    errorMessage,
    isNative,
    startScanning,
    stopScanning,
    connectDevice,
    disconnectDevice
  };
}
