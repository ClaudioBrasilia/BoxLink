import { useState, useEffect } from 'react';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

export function useHeartRate() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<any>(null);

  const connectHeartRateMonitor = async () => {
    try {
      await BleClient.initialize();

      const device = await BleClient.requestDevice({
        services: ['heart_rate'],
      });

      await BleClient.connect(device.deviceId);
      setDevice(device);
      setIsConnected(true);

      await BleClient.startNotifications(
        device.deviceId,
        'heart_rate',
        'heart_rate_measurement',
        (value) => {
          const dataView = new DataView(value.buffer);
          const flags = dataView.getUint8(0);
          const bpmValue = dataView.getUint8(1); // BPM está no segundo byte

          setBpm(bpmValue);

          // Enviar para Supabase em tempo real
          updateBPMInSupabase(bpmValue);
        }
      );

      console.log('✅ Monitor cardíaco conectado!');
    } catch (error) {
      console.error('Erro ao conectar monitor:', error);
      alert('Não foi possível conectar o relógio. Tente novamente.');
    }
  };

  const updateBPMInSupabase = async (currentBpm: number) => {
    const user = supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('live_heart_rate')
      .upsert({
        user_id: (await user).data.user?.id,
        bpm: currentBpm,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.error('Erro ao enviar BPM:', error);
  };

  const disconnect = async () => {
    if (device) {
      await BleClient.stopNotifications(device.deviceId, 'heart_rate', 'heart_rate_measurement');
      await BleClient.disconnect(device.deviceId);
      setIsConnected(false);
      setBpm(null);
      setDevice(null);
    }
  };

  return {
    bpm,
    isConnected,
    connectHeartRateMonitor,
    disconnect
  };
}
