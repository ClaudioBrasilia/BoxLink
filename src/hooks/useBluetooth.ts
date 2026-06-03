// src/hooks/useBluetooth.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

// UUIDs Padronizados Bluetooth
const HEART_RATE_SERVICE     = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE        = numberToUUID(0x180f);
const BATTERY_LEVEL          = numberToUUID(0x2a19);

// Prefixos de nome aceitos no scan
const NAME_PREFIXES = [
  'Watch', 'Smart', 'Band', 'Fit', 'Heart', 'HRM', 'BT', 'ID',
  'Garmin', 'Polar', 'Wahoo', 'TICKR', 'CooSpo', 'Amazfit',
  'MiSmart', 'Mi Band', 'H', 'Relógio', 'Pulseira'
];

export type BluetoothStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error' | 'unsupported';

export interface BluetoothDevice {
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
  const [devices, setDevices]           = useState<BluetoothDevice[]>([]);
  const [status, setStatus]             = useState<BluetoothStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const devicesRef  = useRef<Map<string, BluetoothDevice>>(new Map());
  const listenerRef = useRef<any>(null);
  const isNative    = Capacitor.isNativePlatform();

  const syncToSupabase = useCallback(async (deviceId: string, bpm: number, deviceName: string) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        { user_id: userId, bpm, device_id: deviceId, device_name: deviceName, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    } catch (err) { console.error('[Bluetooth] Erro ao sincronizar:', err); }
  }, [userId]);

  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try { await supabase.from('heart_rate_live').delete().eq('user_id', userId); }
    catch (err) { console.error('[Bluetooth] Erro ao remover:', err); }
  }, [userId]);

  const initializeBle = useCallback(async () => {
    try {
      await BleClient.initialize();
    } catch (err) {
      console.error('[Bluetooth] Erro ao inicializar:', err);
      setErrorMessage('Bluetooth não disponível neste dispositivo');
      setStatus('unsupported');
    }
  }, []);

  const parseHeartRate = (value: DataView): number => {
    const flags = value.getUint8(0);
    return (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
  };

  const readBattery = useCallback(async (deviceId: string): Promise<number | null> => {
    try {
      const battery = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
      return battery.getUint8(0);
    } catch { return null; }
  }, []);

  const connectDevice = useCallback(async (deviceId: string) => {
    try {
      const device = devicesRef.current.get(deviceId);
      if (!device) return;

      setStatus('connecting');
      await BleClient.connect(deviceId, (id) => {
        const dev = devicesRef.current.get(id);
        if (dev) { dev.status = 'disconnected'; setDevices(Array.from(devicesRef.current.values())); }
      });

      await BleClient.discoverServices(deviceId);

      const battery = await readBattery(deviceId);
      if (battery !== null) device.battery = battery;

      await BleClient.startNotifications(
        deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT,
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

  const disconnectDevice = useCallback(async (deviceId: string) => {
    try {
      await BleClient.stopNotifications(deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
      await BleClient.disconnect(deviceId);
      const device = devicesRef.current.get(deviceId);
      if (device) { device.status = 'disconnected'; device.bpm = null; setDevices(Array.from(devicesRef.current.values())); }
    } catch (err) { console.error('[Bluetooth] Erro ao desconectar:', err); }
  }, []);

  const disconnectAll = useCallback(async () => {
    for (const [deviceId] of devicesRef.current) { await disconnectDevice(deviceId); }
    removeFromSupabase();
    setStatus('idle');
  }, [disconnectDevice, removeFromSupabase]);

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

      // Scan sem filtro de serviço para encontrar dispositivos que não anunciam o UUID Heart Rate
      await BleClient.requestLEScan(
        {
          // Alguns dispositivos Garmin/Polar só aparecem se não houver filtro de serviço no scan
        },
        (result) => {
          const name = result.device.name || '';
          const deviceId = result.device.deviceId;

          // Filtramos manualmente por nome ou por UUIDs conhecidos
          const knownName = NAME_PREFIXES.some(p => name.toLowerCase().includes(p.toLowerCase()));
          const hasHRUuid = (result as any).uuids?.includes(HEART_RATE_SERVICE) ||
                            (result as any).services?.includes(HEART_RATE_SERVICE);

          if (!knownName && !hasHRUuid) return;

          const device: BluetoothDevice = {
            id: deviceId,
            name: name || `Dispositivo ${deviceId.substring(0, 8)}`,
            bpm: null, battery: null, status: 'disconnected', lastUpdate: null,
          };

          if (!devicesRef.current.has(deviceId)) {
            devicesRef.current.set(deviceId, device);
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

  const stopScanning = useCallback(async () => {
    try { await BleClient.stopLEScan(); setStatus('idle'); }
    catch (err) { console.error('[Bluetooth] Erro ao parar scan:', err); }
  }, []);

  useEffect(() => { return () => { disconnectAll(); }; }, [disconnectAll]);

  return { devices, status, errorMessage, isNative, startScanning, stopScanning, connectDevice, disconnectDevice, disconnectAll };
}
