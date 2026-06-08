// src/hooks/useHeartRate.ts
import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';

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

const HEART_RATE_SERVICE = 0x180D;
const HEART_RATE_MEASUREMENT = 0x2A37;

// Lista de prefixos sugerida para limpar a busca sem perder os relógios sem marca
const NAME_PREFIXES = [
  'HRM', 'Polar', 'TICKR', 'CooSpo', 'Magene', 'Coospo',
  'Garmin', 'Amazfit', 'MiSmart', 'Mi Band', 'Wahoo',
  'Galaxy Watch', 'Galaxy Fit', 'SM-R', 'Watch', 'Relógio', 'Pulseira'
];

export function useHeartRate(userId: string | undefined): UseHeartRateReturn {
  const [bpm, setBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBpmRef = useRef<number | null>(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isNative = Capacitor.isNativePlatform();
  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const syncToSupabase = useCallback(async (currentBpm: number) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        { user_id: userId, bpm: currentBpm, updated_at: new Date().toISOString() },
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

  const handleHeartRateChange = useCallback((event: Event) => {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    if (!char.value) return;
    const flags = char.value.getUint8(0);
    const is16bit = (flags & 0x1) !== 0;
    const newBpm = is16bit ? char.value.getUint16(1, true) : char.value.getUint8(1);
    if (newBpm > 0 && newBpm < 250) {
      setBpm(newBpm);
      lastBpmRef.current = newBpm;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (characteristicRef.current) characteristicRef.current.removeEventListener('characteristicvaluechanged', handleHeartRateChange);
    if (deviceRef.current?.gatt?.connected) deviceRef.current.gatt.disconnect();
    deviceRef.current = null;
    removeFromSupabase();
    setBpm(null);
    setStatus('disconnected');
    setDeviceName(null);
  }, [handleHeartRateChange, removeFromSupabase]);

  const connect = useCallback(async () => {
    setErrorMessage(null);

    if (isIOS && !isNative) {
      setErrorMessage('No iPhone, o Bluetooth só funciona pelo aplicativo CrossCity Hub instalado.');
      setStatus('error');
      return;
    }

    if (!isSupported) {
      setErrorMessage('Bluetooth não disponível. Use o Chrome no Android ou instale o App.');
      setStatus('error');
      return;
    }

    try {
      setStatus('connecting');

      // Lógica de Filtro Aprimorada:
      // Buscamos por dispositivos que tenham o serviço de Heart Rate OU que comecem com os nomes da lista.
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [HEART_RATE_SERVICE] }, // Filtro por serviço (mais preciso)
          ...NAME_PREFIXES.map(prefix => ({ namePrefix: prefix })) // Filtro pelos nomes da lista
        ],
        optionalServices: [HEART_RATE_SERVICE, 0x180F, 0x180A]
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'Dispositivo');

      device.addEventListener('gattserverdisconnected', () => {
        setStatus('disconnected');
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
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

      syncIntervalRef.current = setInterval(() => {
        if (lastBpmRef.current) syncToSupabase(lastBpmRef.current);
      }, 5000);

    } catch (err: any) {
      console.error('[HeartRate] Connection error:', err);
      if (err.name !== 'NotFoundError') {
        setErrorMessage(err.message || 'Erro ao conectar.');
        setStatus('error');
      } else {
        setStatus('disconnected');
      }
    }
  }, [isIOS, isNative, isSupported, handleHeartRateChange, syncToSupabase, removeFromSupabase]);

  return { bpm, status, deviceName, errorMessage, connect, disconnect, isSupported };
}
