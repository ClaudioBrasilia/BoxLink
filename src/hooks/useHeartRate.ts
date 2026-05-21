// src/hooks/useHeartRate.ts
// Hook para conectar relógio/sensor via Web Bluetooth API
// e sincronizar a FC em tempo real no Supabase

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

// UUID padrão do serviço Heart Rate do Bluetooth GATT
const HEART_RATE_SERVICE = 'heart_rate';
const HEART_RATE_MEASUREMENT_CHAR = 'heart_rate_measurement';

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

  // Envia o BPM atual para o Supabase (upsert)
  const syncToSupabase = useCallback(async (currentBpm: number) => {
    if (!userId) return;
    try {
      await supabase
        .from('heart_rate_live')
        .upsert(
          { user_id: userId, bpm: currentBpm, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.error('[HeartRate] Erro ao sincronizar com Supabase:', err);
    }
  }, [userId]);

  // Remove o registro do Supabase ao desconectar
  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[HeartRate] Erro ao remover registro:', err);
    }
  }, [userId]);

  // Parse dos dados brutos do sensor (padrão GATT Heart Rate)
  const parseHeartRate = (value: DataView): number => {
    // Byte 0 = flags
    // Se bit 0 do flags = 0 → BPM é uint8 (1 byte)
    // Se bit 0 do flags = 1 → BPM é uint16 (2 bytes)
    const flags = value.getUint8(0);
    const is16bit = (flags & 0x1) !== 0;
    return is16bit ? value.getUint16(1, true) : value.getUint8(1);
  };

  const handleHeartRateChange = useCallback((event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;

    const newBpm = parseHeartRate(characteristic.value);
    setBpm(newBpm);
    lastBpmRef.current = newBpm;
  }, []);

  const disconnect = useCallback(() => {
    // Para o intervalo de sync
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    // Remove listener do characteristic
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener(
        'characteristicvaluechanged',
        handleHeartRateChange
      );
      characteristicRef.current = null;
    }

    // Desconecta o dispositivo Bluetooth
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    deviceRef.current = null;

    // Remove do Supabase
    removeFromSupabase();

    setBpm(null);
    setStatus('disconnected');
    setDeviceName(null);
    setErrorMessage(null);
    lastBpmRef.current = null;
  }, [handleHeartRateChange, removeFromSupabase]);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage('Web Bluetooth não é suportado neste navegador. Use Chrome ou Edge no Android/Desktop.');
      setStatus('error');
      return;
    }

    if (!userId) {
      setErrorMessage('Você precisa estar logado para conectar o relógio.');
      setStatus('error');
      return;
    }

    try {
      setStatus('connecting');
      setErrorMessage(null);

      // Abre o seletor de dispositivos Bluetooth do navegador
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        // Alguns relógios (Garmin, Polar, etc) usam serviços customizados
        optionalServices: [HEART_RATE_SERVICE],
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'Dispositivo desconhecido');

      // Listener para desconexão inesperada
      device.addEventListener('gattserverdisconnected', () => {
        console.warn('[HeartRate] Dispositivo desconectado inesperadamente');
        setStatus('disconnected');
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
        removeFromSupabase();
        setBpm(null);
        setDeviceName(null);
      });

      // Conecta ao servidor GATT
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT_CHAR);

      characteristicRef.current = characteristic;

      // Habilita notificações de mudança de BPM
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleHeartRateChange);

      setStatus('connected');

      // Sincroniza com Supabase a cada 3 segundos
      syncIntervalRef.current = setInterval(() => {
        if (lastBpmRef.current !== null) {
          syncToSupabase(lastBpmRef.current);
        }
      }, 3000);

    } catch (err: any) {
      console.error('[HeartRate] Erro de conexão:', err);

      // Usuário cancelou o seletor → não é erro real
      if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
        setStatus('disconnected');
        return;
      }

      setStatus('error');
      if (err.name === 'SecurityError') {
        setErrorMessage('Permissão Bluetooth negada. Verifique as configurações do navegador.');
      } else if (err.name === 'NotSupportedError') {
        setErrorMessage('Seu relógio não suporta o perfil Heart Rate padrão.');
      } else {
        setErrorMessage(err.message || 'Erro desconhecido ao conectar.');
      }
    }
  }, [isSupported, userId, handleHeartRateChange, syncToSupabase, removeFromSupabase]);

  return { bpm, status, deviceName, errorMessage, connect, disconnect, isSupported };
}
