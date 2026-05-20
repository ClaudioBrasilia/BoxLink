import { useState } from 'react';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

export function useHeartRate() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const connectHeartRateMonitor = async () => {
    try {
      await BleClient.initialize();

      const device = await BleClient.requestDevice({
        services: ['heart_rate'],
      });

      await BleClient.connect(device.deviceId);
      setDeviceId(device.deviceId);
      setIsConnected(true);

      await BleClient.startNotifications(
        device.deviceId,
        'heart_rate',
        'heart_rate_measurement',
        (value) => {
          const dataView = new DataView(value.buffer);
          let heartRate = dataView.getUint8(1); // BPM geralmente está no byte 1

          // Alguns dispositivos usam formato diferente
          if (heartRate === 0) heartRate = dataView.getUint8(2);

          setBpm(heartRate);
          updateBPMInSupabase(heartRate);
        }
      );

      alert('✅ Monitor cardíaco conectado com sucesso!');
    } catch (error: any) {
      console.error(error);
      alert('❌ Erro ao conectar: ' + (error.message || 'Verifique o Bluetooth'));
    }
  };

  const updateBPMInSupabase = async (currentBpm: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('live_heart_rate')
        .upsert({
          user_id: user.id,
          bpm: currentBpm,
        }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Erro ao enviar BPM:', e);
    }
  };

  const disconnect = async () => {
    if (deviceId) {
      try {
        await BleClient.stopNotifications(deviceId, 'heart_rate', 'heart_rate_measurement');
        await BleClient.disconnect(deviceId);
      } catch (e) {}
    }
    setIsConnected(false);
    setBpm(null);
    setDeviceId(null);
  };

  return {
    bpm,
    isConnected,
    connectHeartRateMonitor,
    disconnect
  };
}
