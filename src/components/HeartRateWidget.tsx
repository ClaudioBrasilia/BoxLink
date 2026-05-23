// src/components/HeartRateWidget.tsx
// Widget atualizado com Guia de Ajuda e Links de Terceiros

import React, { useState } from 'react';
import { Heart, Bluetooth, BluetoothOff, Loader2, AlertCircle, X, HelpCircle, ExternalLink, Smartphone, Watch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeartRate, ConnectionStatus } from '../hooks/useHeartRate';
import { cn } from '../lib/utils';

// ... (lógica de zonas e status mantida)

export default function HeartRateWidget({ userId, className }: HeartRateWidgetProps) {
  const { bpm, status, deviceName, errorMessage, connect, disconnect, isSupported } = useHeartRate(userId);
  const [showHelp, setShowHelp] = useState(false); // Estado para o Modal de Ajuda

  return (
    <div className={cn('bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden', className)}>
      {/* Header com o novo botão de ajuda */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={cn('w-5 h-5', status === 'connected' ? 'text-red-400 animate-pulse' : 'text-white/30')} />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Frequência Cardíaca</h3>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHelp(true)} className="text-white/20 hover:text-primary transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
          {/* Status da conexão */}
        </div>
      </div>

      {/* ... (BPM e botões de ação) */}

      {/* NOVO: Modal de Ajuda Dinâmico */}
      <AnimatePresence>
        {showHelp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/95 p-5 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-primary font-black uppercase italic text-xs tracking-tighter">Guia de Conexão</h4>
              <button onClick={() => setShowHelp(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Apple Watch */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]"><Watch className="w-3 h-3 text-primary" /> Apple Watch</div>
                <p className="text-white/60 text-[9px] leading-relaxed mb-2">Requer o app <strong>HeartCast</strong> para transmitir o sinal Bluetooth.</p>
                <a href="https://apps.apple.com/app/id1499771124" target="_blank" className="flex items-center gap-1 text-primary text-[9px] font-black uppercase">Baixar HeartCast <ExternalLink className="w-2 h-2" /></a>
              </div>

              {/* Samsung/WearOS */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]"><Watch className="w-3 h-3 text-primary" /> Samsung / WearOS</div>
                <p className="text-white/60 text-[9px] leading-relaxed mb-2">Use o app <strong>Heart for Bluetooth</strong> para habilitar a transmissão.</p>
                <a href="https://play.google.com/store/apps/details?id=com.luismorigaki.heartforbluetooth" target="_blank" className="flex items-center gap-1 text-primary text-[9px] font-black uppercase">Baixar na Play Store <ExternalLink className="w-2 h-2" /></a>
              </div>

              {/* Garmin */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]"><Watch className="w-3 h-3 text-primary" /> Garmin</div>
                <p className="text-white/60 text-[9px] leading-relaxed">Vá em: <strong>Configurações > Sensores > FC no Pulso > Transmitir FC</strong>.</p>
              </div>

              {/* Genéricos */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]"><Smartphone className="w-3 h-3 text-primary" /> Relógios Genéricos</div>
                <p className="text-white/60 text-[9px] leading-relaxed">Muitos modelos genéricos não permitem conexão direta. Recomendamos o uso de uma <strong>cinta peitoral Bluetooth</strong>.</p>
              </div>
            </div>

            <button onClick={( ) => setShowHelp(false)} className="mt-6 w-full py-2 bg-primary text-black font-black uppercase text-[10px] rounded-lg">Entendi</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
