import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CapacitorHealth } from '@capgo/capacitor-health';
import { Capacitor } from '@capacitor/core';
import { Heart, HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HeartRateWidgetProps {
  userId: string | undefined;
}

export default function HeartRateWidget({ userId }: HeartRateWidgetProps) {
  const [bpm, setBpm] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('boxlink-live-hr');
    channel.subscribe();

    let intervalId: any;

    const startTracking = async () => {
      if (!Capacitor.isNativePlatform()) {
        setPermissionStatus('granted');
        setIsTracking(true);
        intervalId = setInterval(() => {
          const mockBpm = Math.floor(Math.random() * (155 - 110 + 1)) + 110;
          setBpm(mockBpm);
          channel.send({
            type: 'broadcast',
            event: 'pulse',
            payload: { user_id: userId, bpm: mockBpm }
          });
        }, 3000);
        return;
      }

      try {
        const permission = await CapacitorHealth.requestPermissions({
          read: ['heart_rate']
        });

        if (permission) {
          setPermissionStatus('granted');
          setIsTracking(true);

          intervalId = setInterval(async () => {
            const now = new Date();
            const pre = new Date(now.getTime() - 15000);

            const data = await CapacitorHealth.queryHRElements({
              startDate: pre.toISOString(),
              endDate: now.toISOString(),
              dataType: 'heart_rate'
            });

            if (data && data.values && data.values.length > 0) {
              const latestBpm = Math.round(data.values[data.values.length - 1].value);
              setBpm(latestBpm);

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

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!userId) return null;

  return (
    <>
      <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="bg-red-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
            <Heart className={`w-5 h-5 text-red-400 ${bpm > 0 ? 'animate-pulse' : ''}`} />
          </div>
          
          {/* BOTÃO DE INTERROGAÇÃO / AJUDA */}
          <button 
            onClick={() => setShowHelpModal(true)}
            className="text-on-surface-variant/40 hover:text-primary transition-colors p-1"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
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
          
          <p className="text-[9px] text-on-surface-variant/60 mt-2 font-sans">
            {permissionStatus === 'denied' && "⚠️ Ative as permissões de Saúde nas configurações do celular."}
            {isTracking && "✨ Transmitindo direto para a TV do Box. Mantenha o app aberto!"}
          </p>
        </div>
      </div>

      {/* MODAL DE INSTRUÇÕES (ESTILO DO SEU PROJETO) */}
      <AnimatePresence>
        {showHelpModal && (
          <div 
            className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" /> COMO CONECTAR SEU RELÓGIO
                </h3>
                <button onClick={() => setShowHelpModal(false)} className="text-on-surface-variant">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4 text-xs font-sans text-on-surface-variant">
                
                <div className="flex gap-3 bg-surface-container-highest/40 p-3 rounded-2xl">
                  <span className="font-headline font-black text-primary text-base">01</span>
                  <p><strong>Permissão Inicial:</strong> Ao abrir esta tela, o BoxLink pede permissão para acessar seus dados de saúde. Certifique-se de <strong>permitir</strong> o acesso aos batimentos cardíacos.</p>
                </div>

                <div className="flex gap-3 bg-surface-container-highest/40 p-3 rounded-2xl">
                  <span className="font-headline font-black text-primary text-base">02</span>
                  <p><strong>Para Apple Watch e Galaxy Watch:</strong> Seu relógio envia os dados automaticamente para o celular. Você só precisa <strong>manter o aplicativo BoxLink aberto ou em segundo plano</strong> no celular durante o treino.</p>
                </div>

                <div className="flex gap-3 bg-surface-container-highest/40 p-3 rounded-2xl">
                  <span className="font-headline font-black text-primary text-base">03</span>
                  <p><strong>Para Mi Band e Amazfit:</strong> Vá no aplicativo do seu relógio (Zepp ou Mi Fitness) e ative a opção <strong>"Compartilhamento de Frequência Cardíaca"</strong> ou <strong>"Visível para dispositivos próximos"</strong>.</p>
                </div>

                <div className="flex gap-3 bg-primary/10 border border-primary/20 p-3 rounded-2xl items-center">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider text-center w-full">
                    🔥 Pronto! Seu nome aparecerá no telão do Box automaticamente.
                  </p>
                </div>

                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="w-full bg-primary text-background py-3 rounded-xl font-headline font-black uppercase italic mt-2 text-sm"
                >
                  ENTENDI, BORA PRO WOD!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
