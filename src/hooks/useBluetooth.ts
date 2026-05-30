import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice, numberToUUID } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

// UUIDs Padronizados Bluetooth e Comuns para Dispositivos de Frequência Cardíaca
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb'; // Padrão Bluetooth SIG
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb'; // Característica de Medição de FC
const BATTERY_SERVICE = numberToUUID(0x180f);
const BATTERY_LEVEL = numberToUUID(0x2a19);

// UUIDs adicionais para aumentar a compatibilidade com smartwatches genéricos/chineses
// Adicione aqui outros UUIDs de serviço de FC que seu relógio possa anunciar.
// O UUID '00003802-0000-1000-8000-00805f9b34fb' foi identificado no dispositivo do usuário.
const ADDITIONAL_HEART_RATE_SERVICES = [
  '00003802-0000-1000-8000-00805f9b34fb', // UUID identificado no relógio do usuário
  // Exemplo de outros UUIDs comuns para dispositivos como Xiaomi, Huawei, Polar, Garmin, etc.
  // '00002a37-0000-1000-8000-00805f9b34fb', // Heart Rate Measurement Characteristic (já incluído como HEART_RATE_MEASUREMENT, mas pode ser útil aqui se o dispositivo o anunciar como serviço)
  // '00002a39-0000-1000-8000-00805f9b34fb', // Heart Rate Control Point Characteristic
  // '00002a19-0000-1000-8000-00805f9b34fb', // Battery Level Characteristic (já incluído como BATTERY_LEVEL, mas pode ser útil aqui se o dispositivo o anunciar como serviço)
  // '0000fe00-0000-1000-8000-00805f9b34fb', // Exemplo de UUID genérico/proprietário (muitas vezes usado por Xiaomi Mi Band)
  // '0000fe01-0000-1000-8000-00805f9b34fb', // Outro exemplo de UUID genérico/proprietário
];

export type BluetoothStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error' | 'unsupported';

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
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
}

export function useBluetooth(userId: string | undefined): UseBluetoothReturn {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [status, setStatus] = useState<BluetoothStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const devicesRef = useRef<Map<string, BluetoothDevice>>(new Map());
  const listenerRef = useRef<any>(null);
  const isNative = Capacitor.isNativePlatform();

  // Sincronizar com Supabase
  const syncToSupabase = useCallback(async (deviceId: string, bpm: number, deviceName: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('heart_rate_live')
        .upsert(
          {
            user_id: userId,
            bpm,
            device_id: deviceId,
            device_name: deviceName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.error('[Bluetooth] Erro ao sincronizar:', err);
    }
  }, [userId]);

  // Remover do Supabase
  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[Bluetooth] Erro ao remover:', err);
    }
  }, [userId]);

  // Inicializar BLE
  const initializeBle = useCallback(async () => {
    try {
      await BleClient.initialize();
    } catch (err) {
      console.error('[Bluetooth] Erro ao inicializar:', err);
      setErrorMessage('Bluetooth não disponível neste dispositivo');
      setStatus('unsupported');
    }
  }, []);

  // Parsear frequência cardíaca
  const parseHeartRate = (value: DataView): number => {
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    if (rate16Bits > 0) {
      return value.getUint16(1, true);
    }
    return value.getUint8(1);
  };

  // Ler bateria
  const readBattery = useCallback(async (deviceId: string): Promise<number | null> => {
    try {
      const battery = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
      return battery.getUint8(0);
    } catch (err) {
      console.error('[Bluetooth] Erro ao ler bateria:', err);
      return null;
    }
  }, []);

  // Conectar a um dispositivo
  const connectDevice = useCallback(async (deviceId: string) => {
    try {
      const device = devicesRef.current.get(deviceId);
      if (!device) return;

      setStatus('connecting');
      await BleClient.connect(deviceId, (id) => {
        console.log(`[Bluetooth] Desconectado: ${id}`);
        const dev = devicesRef.current.get(id);
        if (dev) {
          dev.status = 'disconnected';
          setDevices(Array.from(devicesRef.current.values()));
        }
      });

      // Descobrir serviços
      await BleClient.discoverServices(deviceId);

      // Ler bateria
      const battery = await readBattery(deviceId);
      if (battery !== null) {
        device.battery = battery;
      }

      // Iniciar notificações de FC
      await BleClient.startNotifications(
        deviceId,
        HEART_RATE_SERVICE,
        HEART_RATE_MEASUREMENT,
        (value) => {
          const bpm = parseHeartRate(value);
          device.bpm = bpm;
          device.lastUpdate = new Date();
          setDevices(Array.from(devicesRef.current.values()));
          syncToSupabase(deviceId, bpm, device.name);
        }
      );

      device.status = 'connected';
      setStatus('connected');
      setDevices(Array.from(devicesRef.current.values()));
    } catch (err: any) {
      console.error('[Bluetooth] Erro ao conectar:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro ao conectar');
    }
  }, [readBattery, syncToSupabase]);

  // Desconectar de um dispositivo
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
    } catch (err) {
      console.error('[Bluetooth] Erro ao desconectar:', err);
    }
  }, []);

  // Desconectar de todos
  const disconnectAll = useCallback(async () => {
    for (const [deviceId] of devicesRef.current) {
      await disconnectDevice(deviceId);
    }
    removeFromSupabase();
    setStatus('idle');
  }, [disconnectDevice, removeFromSupabase]);

  // Iniciar scanning
  const startScanning = useCallback(async () => {
    if (!isNative) {
      setStatus('unsupported');
      setErrorMessage('Esta função requer o app instalado no celular.');
      return;
    }

    try {
      setStatus('scanning');
      setErrorMessage(null);
      await initializeBle();

      // Listener para dispositivos encontrados
      listenerRef.current = await BleClient.requestLEScan(
        {
          services: [HEART_RATE_SERVICE, ...ADDITIONAL_HEART_RATE_SERVICES],
        },
        (result) => {
          const device: BluetoothDevice = {
            id: result.device.deviceId,
            name: result.device.name || `Dispositivo ${result.device.deviceId.substring(0, 8)}`,
            bpm: null,
            battery: null,
            status: 'disconnected',
            lastUpdate: null,
          };

          if (!devicesRef.current.has(result.device.deviceId)) {
            devicesRef.current.set(result.device.deviceId, device);
            setDevices(Array.from(devicesRef.current.values()));
          }
        }
      );
    } catch (err: any) {
      console.error('[Bluetooth] Erro ao escanear:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro ao escanear');
    }
  }, [isNative, initializeBle]);

  // Parar scanning
  const stopScanning = useCallback(async () => {
    try {
      await BleClient.stopLEScan();
      setStatus('idle');
    } catch (err) {
      console.error('[Bluetooth] Erro ao parar scan:', err);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      disconnectAll();
    };
  }, [disconnectAll]);

  return {
    devices,
    status,
    errorMessage,
    isNative,
    startScanning,
    stopScanning,
    connectDevice,
    disconnectDevice,
    disconnectAll,
  };
}
