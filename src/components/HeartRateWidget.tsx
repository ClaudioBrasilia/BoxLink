import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Mantendo seu padrão de import do PDF
import { CapacitorHealth } from '@capgo/capacitor-health';
import { Capacitor } from '@capacitor/core';
import { Heart, Activity } from 'lucide-react';

interface HeartRateWidgetProps {
  userId: string | undefined;
}

export default function HeartRateWidget({ userId }: HeartRateWidgetProps) {
  const [bpm, setBpm] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');

  useEffect(() => {
    if (!userId) return;

    // Conecta no canal Realtime global para transmissão rápida
    const channel = supabase.channel('boxlink-live-hr');
    channel.subscribe();

    let intervalId: any;

    const startTracking = async () => {
      // 1. Se estiver rodando no navegador do PC (Desenvolvimento) -> Simula os batimentos
      if (!Capacitor.isNativePlatform()) {
        setPermissionStatus('granted');
        setIsTracking(true);
        intervalId = setInterval(() => {
          const mockBpm = Math.floor(Math.random() * (155 - 110 + 1)) + 110;
          setBpm(mockBpm);

          // Dispara via Broadcast sem tocar no banco de dados
          channel.send({
            type: 'broadcast',
            event: 'pulse',
            payload: { user_id: userId, bpm: mockBpm }
          });
        }, 3000); // Envia a cada 3 segundos
        return;
      }

      // 2. Se estiver no Celular Nativo -> Usa os sensores do Apple Watch / Galaxy Watch
      try {
        const permission = await CapacitorHealth.requestPermissions({
          read: ['heart_rate']
        });

        if (permission) {
          setPermissionStatus('granted');
          setIsTracking(true);

          intervalId = setInterval(async () => {
            const now = new Date();
            const pre = new Date(now.getTime() - 15000); // Pega os últimos 15 segundos

            const data = await CapacitorHealth.queryHRElements({
              startDate: pre.toISOString(),
              endDate: now.toISOString(),
              dataType: 'heart_rate'
            });

            if (data && data.values && data.values.length > 0) {
              const latestBpm = Math.round(data.values[data.values.length - 1].value);
              setBpm(latestBpm);

              // Transmite para a TV em tempo real
              channel.send({
                type: 'broadcast',
                event: 'pulse',
                payload: { user_id: userId, bpm: latestBpm }
              });
            }
          }, 3000);
        } else {
          setPermissionStatus('denied');
        }
      } catch (error) {
        console.error('Erro ao acessar dados de frequência cardíaca:', error);
        setPermissionStatus('error');
      }
    };

    startTracking();

    // Limpa os processos e o canal ao sair da tela ou fechar o app
    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
      <div className="bg-red-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
        <Heart className={`w-5 h-5 text-red-400 ${bpm > 0 ? 'animate-pulse' : ''}`} />
      </div>
      <div>
        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
          Frequência Cardíaca (WOD Live)
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-headline font-black text-on-surface">
            {bpm > 0 ? `${bpm}` : '---'}
          </p>
          <span className="text-xs text-on-surface-variant font-bold">BPM</span>
        </div>
        
        {/* Feedback visual de ajuda ao aluno */}
        <p className="text-[9px] text-on-surface-variant/60 mt-2 font-sans">
          {permissionStatus === 'denied' && "⚠️ Ative as permissões de Saúde nas configurações do celular."}
          {isTracking && "✨ Transmitindo direto para a TV do Box. Mantenha o app aberto!"}
        </p>
      </div>
    </div>
  );
}
