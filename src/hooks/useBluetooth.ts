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

  // HealthKit (importação segura para iOS)
  let HealthKit: any = null;
  if (isNative && platform === 'ios') {
    import('@capacitor-community/health-kit').then(mod => {
      HealthKit = mod.HealthKit;
    });
  }

  // Verifica se é um relógio prioritário
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

  // Inicializa Bluetooth
  const initializeBle = useCallback(async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      
      // HealthKit apenas em iOS nativo
      if (isNative && platform === 'ios' && HealthKit) {
        await HealthKit.requestAuthorization({
          read: ['heartRate'],
          write: []
        });
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
    try {
      await BleClient.connect(deviceId);
      await BleClient.discoverServices(deviceId);

      // Lê bateria (se disponível)
      try {
        const battery = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
        device.battery = battery.getUint8(0);
      } catch {}

      // Monitora batimentos
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
      setErrorMessage(platform === 'ios' 
        ? 'Conecte via HealthKit (Apple Watch)' 
        : err.message
      );
    }
  }, [syncToSupabase, platform]);

  // Desconecta dispositivo
  const disconnectDevice = useCallback(async (deviceId: string) => {
    try {
      await BleClient.stopNotifications(deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
      await BleClient.disconnect(deviceId);
      const device = devicesRef.current.get(deviceId);
      if (device) { 
        device.status = 'disconnected'; 
        device.bpm = null; 
        setDevices(Array.from(devicesRef.current.values())); 
      }
    } catch (err) { console.error('[Bluetooth] Erro ao desconectar:', err); }
  }, []);

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
      await BleClient.stopLEScan();
      if (status === 'scanning') setStatus('idle');
    } catch (err) { console.error('[Bluetooth] Erro ao parar scan:', err); }
  }, [status]);

  // Inicia escaneamento
  const startScanning = useCallback(async () => {
    if (!isNative) {
      setErrorMessage('Requer app nativo');
      setStatus('unsupported');
      return;
    }

    setStatus('scanning');
    setErrorMessage(null);
    devicesRef.current.clear();
    setDevices([]);

    try {
      await initializeBle();

      const onResult = (result: any) => {
        const name = result.device.name || '';
        const deviceId = result.device.deviceId;
        const isPriority = isPriorityDevice(name);

        // Filtra dispositivos com BPM ou prioritários
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

      // Configura escaneamento por plataforma
      await BleClient.requestLEScan(
        platform === 'ios' 
          ? { services: [HEART_RATE_SERVICE] }
          : {},
        onResult
      );

      // Para após 30 segundos
      setTimeout(() => stopScanning(), 30000);
    } catch (err: any) {
      console.error('[Scan] Erro:', err);
      setStatus('error');
      setErrorMessage(
        platform === 'android' 
          ? 'Ative Bluetooth e Localização' 
          : 'Permita acesso ao HealthKit'
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
