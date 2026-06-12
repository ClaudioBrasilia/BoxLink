// src/hooks/useBluetooth.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { HealthKit } from '@capacitor-community/health-kit'; // Para iOS
import { supabase } from '../lib/supabase';

// UUIDs Bluetooth SIG + APIs de relógios
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
  isPriority?: boolean; // Novo campo para relógios
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

  // Inicializa Bluetooth e APIs de saúde
  const initialize = useCallback(async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      
      // Configura HealthKit (iOS)
      if (platform === 'ios') {
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
  }, [platform]);

  // Conecta a um dispositivo
  const connectDevice = useCallback(async (deviceId: string) => {
    const device = devicesRef.current.get(deviceId);
    if (!device) return;

    setStatus('connecting');
    try {
      // Conexão padrão para BLE
      await BleClient.connect(deviceId);
      await BleClient.discoverServices(deviceId);

      // Lê bateria (se disponível)
      try {
        const battery = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
        device.battery = battery.getUint8(0);
      } catch {}

      // Inicia monitoramento de BPM
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

  // Escaneia dispositivos
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
      await initialize();

      const onResult = (result: any) => {
        const name = result.device.name || '';
        const deviceId = result.device.deviceId;
        const isPriority = isPriorityDevice(name);

        // Filtra apenas dispositivos com serviço de BPM ou prioritários
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

      // Configuração específica por plataforma
      await BleClient.requestLEScan(
        platform === 'ios' 
          ? { services: [HEART_RATE_SERVICE] } // iOS requer filtro explícito
          : {}, // Android pode escanear sem filtro
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
  }, [isNative, platform, initialize, stopScanning]);

  // ... (disconnectDevice, stopScanning, etc. mantidos iguais)

  return { 
    devices: Array.from(devicesRef.current.values()).sort((a, b) => 
      (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0) // Relógios primeiro
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
