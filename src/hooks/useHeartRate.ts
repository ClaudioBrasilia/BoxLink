// src/hooks/useHeartRate.ts
// Hook para conectar relógio/sensor via Web Bluetooth API (GATT padrão)
import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseHeartRateReturn {
  bpm: number | null;
  status: ConnectionStatus;
  deviceName: string | null;
  errorMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isSupported: boolean;
}

// UUIDs padrão Bluetooth SIG
const HEART_RATE_SERVICE = 0x180D;
const HEART_RATE_MEASUREMENT = 0x2A37;
const BATTERY_SERVICE = 0x180F;
const DEVICE_INFO_SERVICE = 0x180A;

// UUID proprietário do Polar (PMD — dados de sensor avançados)
const POLAR_PMD_SERVICE = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';

export function useHeartRate(userId: string | undefined): UseHeartRateReturn {
  const [bpm, setBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBpmRef = useRef<number | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const syncToSupabase = useCallback(async (currentBpm: number) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        {
          user_id: userId,
          bpm: currentBpm,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('[HeartRate] Sync error:', err);
    }
  }, [userId]);

  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[HeartRate] Remove error:', err);
    }
  }, [userId]);

  const parseHeartRate = (value: DataView): number => {
    const flags = value.getUint8(0);
    const is16bit = (flags & 0x1) !== 0;
    return is16bit ? value.getUint16(1, true) : value.getUint8(1);
  };

  const handleHeartRateChange = useCallback((event: Event) => {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    if (!char.value) return;
    const newBpm = parseHeartRate(char.value);
    if (newBpm > 0 && newBpm < 250) {
      setBpm(newBpm);
      lastBpmRef.current = newBpm;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener('characteristicvaluechanged', handleHeartRateChange);
      characteristicRef.current = null;
    }
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    deviceRef.current = null;
    removeFromSupabase();
    setBpm(null);
    setStatus('disconnected');
    setDeviceName(null);
    lastBpmRef.current = null;
  }, [handleHeartRateChange, removeFromSupabase]);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage('Use Chrome ou Edge para conectar via Bluetooth.');
      setStatus('error');
      return;
    }

    if (!userId) {
      setErrorMessage('Você precisa estar logado.');
      setStatus('error');
      return;
    }

    try {
      setStatus('connecting');
      setErrorMessage(null);

      // CORREÇÃO: Usar acceptAllDevices para evitar erro de namePrefix vazio
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          HEART_RATE_SERVICE,
          BATTERY_SERVICE,
          DEVICE_INFO_SERVICE,
          POLAR_PMD_SERVICE,
          '0000180d-0000-1000-8000-00805f9b34fb',
          '0000180f-0000-1000-8000-00805f9b34fb',
          '0000180a-0000-1000-8000-00805f9b34fb'
        ]
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'Dispositivo Bluetooth');

      device.addEventListener('gattserverdisconnected', () => {
        setStatus('disconnected');
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
        removeFromSupabase();
        setBpm(null);
        setDeviceName(null);
      });

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);

      characteristicRef.current = characteristic;
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleHeartRateChange);

      setStatus('connected');

      // Sync loop
      syncIntervalRef.current = setInterval(() => {
        if (lastBpmRef.current) {
          syncToSupabase(lastBpmRef.current);
        }
      }, 5000);

    } catch (err: any) {
      console.error('[HeartRate] Connection error:', err);
      if (err.name !== 'NotFoundError') {
        setErrorMessage(err.message || 'Erro ao conectar dispositivo.');
        setStatus('error');
      } else {
        setStatus('disconnected');
      }
    }
  }, [isSupported, userId, handleHeartRateChange, syncToSupabase, removeFromSupabase]);

  return {
    bpm,
    status,
    deviceName,
    errorMessage,
    connect,
    disconnect,
    isSupported
  };
}
