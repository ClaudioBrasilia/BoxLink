// src/components/HeartRateWidget.tsx
// Widget para o aluno conectar o relógio e ver sua FC em tempo real

import React, { useState } from 'react';
import { Heart, Bluetooth, BluetoothOff, Loader2, AlertCircle, X, HelpCircle, ExternalLink, Smartphone, Watch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeartRate, ConnectionStatus } from '../hooks/useHeartRate';
import { cn } from '../lib/utils';

interface HeartRateWidgetProps {
  userId: string | undefined;
  className?: string;
}

// Zona de FC baseada no BPM (referência geral)
function getZone(bpm: number): { label: string; color: string; bg: string; border: string } {
  if (bpm < 100) return { label: 'REPOUSO',    color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30' };
  if (bpm < 120) return { label: 'AQUECIMENTO',color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' };
  if (bpm < 140) return { label: 'AERÓBICO',   color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' };
  if (bpm < 160) return { label: 'ANAERÓBICO', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };
  return               { label: 'MÁXIMO',       color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30' };
}

const statusConfig: Record<ConnectionStatus, { label: string; icon: React.ReactNode; color: string }> = {
  disconnected: { label: 'Desconectado',  icon: <BluetoothOff className="w-4 h-4" />, color: 'text-white/40' },
  connecting:   { label: 'Conectando...', icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-yellow-400' },
  connected:    { label: 'Conectado',     icon: <Bluetooth className="w-4 h-4" />,      color: 'text-green-400' },
  error:        { label: 'Erro',          icon: <AlertCircle className="w-4 h-4" />,    color: 'text-red-400' },
};

export default function HeartRateWidget({ userId, className }: HeartRateWidgetProps) {
  const { bpm, status, deviceName, errorMessage, connect, disconnect, isSupported } = useHeartRate(userId);
  const [showHelp, setShowHelp] = useState(false);

  const zone = bpm ? getZone(bpm) : null;
  const cfg = statusConfig[status];

  return (
    <div className={cn(
      'bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={cn('w-5 h-5', status === 'connected' ? 'text-red-400 animate-pulse' : 'text-white/30')} />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">
            Frequência Cardíaca
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHelp(true)}
            className="text-white/20 hover:text-primary transition-colors"
            title="Ajuda para conectar"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <div className={cn('flex items-center gap-1.5 text-xs font-black uppercase tracking-wider', cfg.color)}>
            {cfg.icon}
            <span>{cfg.label}</span>
          </div>
        </div>
      </div>

      {/* BPM principal */}
      <AnimatePresence mode="wait">
        {status === 'connected' && bpm ? (
          <motion.div
            key="bpm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn('rounded-2xl border p-4 flex flex-col items-center gap-2', zone?.bg, zone?.border)}
          >
            <div className="flex items-end gap-1">
              <span className={cn('text-6xl font-black italic font-headline tabular-nums', zone?.color)}>
                {bpm}
              </span>
              <span className={cn('text-lg font-black uppercase pb-2', zone?.color)}>BPM</span>
            </div>
            <span className={cn('text-xs font-black uppercase tracking-[0.3em] italic', zone?.color)}>
              ZONA: {zone?.label}
            </span>
          </motion.div>
        ) : status === 'connecting' ? (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-3"
          >
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
            <p className="text-yellow-400 text-xs font-black uppercase tracking-widest text-center">
              Buscando dispositivos Bluetooth...
            </p>
            <p className="text-white/30 text-[10px] text-center">
              Selecione seu relógio na janela do navegador
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-2"
          >
            <BluetoothOff className="w-8 h-8 text-white/20" />
            <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
              {isSupported
                ? 'Conecte seu relógio para ver sua FC na TV'
                : 'Use Chrome/Edge para conectar via Bluetooth'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nome do dispositivo */}
      {deviceName && (
        <div className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest">
          <Bluetooth className="w-3 h-3" />
          <span className="truncate">{deviceName}</span>
        </div>
      )}

      {/* Mensagem de erro */}
      {errorMessage && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-[10px] font-black uppercase leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Botão de ação */}
      {status === 'connected' ? (
        <button
          onClick={disconnect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
        >
          <X className="w-4 h-4" />
          Desconectar
        </button>
      ) : status === 'connecting' ? null : (
        <button
          onClick={connect}
          disabled={!isSupported}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
            isSupported
              ? 'bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
          )}
        >
          <Bluetooth className="w-4 h-4" />
          {isSupported ? 'Conectar Relógio' : 'Bluetooth não suportado'}
        </button>
      )}

      {/* Modal de Ajuda */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 p-5 flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-primary font-black uppercase italic text-xs tracking-tighter">Guia de Conexão</h4>
              <button onClick={() => setShowHelp(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Apple Watch */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]">
                  <Watch className="w-3 h-3 text-primary" /> Apple Watch
                </div>
                <p className="text-white/60 text-[9px] leading-relaxed mb-2">
                  Requer o app <strong>HeartCast</strong> para transmitir o sinal Bluetooth.
                </p>
                <a 
                  href="https://apps.apple.com/app/id1499771124" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary text-[9px] font-black uppercase"
                >
                  Baixar HeartCast <ExternalLink className="w-2 h-2" />
                </a>
              </div>

              {/* Samsung/WearOS */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]">
                  <Watch className="w-3 h-3 text-primary" /> Samsung / WearOS
                </div>
                <p className="text-white/60 text-[9px] leading-relaxed mb-2">
                  Use o app <strong>Heart for Bluetooth</strong> para habilitar a transmissão.
                </p>
                <a 
                  href="https://play.google.com/store/apps/details?id=com.luismorigaki.heartforbluetooth" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary text-[9px] font-black uppercase"
                >
                  Baixar na Play Store <ExternalLink className="w-2 h-2" />
                </a>
              </div>

              {/* Garmin */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]">
                  <Watch className="w-3 h-3 text-primary" /> Garmin
                </div>
                <p className="text-white/60 text-[9px] leading-relaxed mb-2">
                  Vá em: <strong>Configurações &gt; Sensores &gt; FC no Pulso &gt; Transmitir FC</strong>.
                </p>
              </div>

              {/* Genéricos */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-white font-black uppercase text-[10px]">
                  <Smartphone className="w-3 h-3 text-primary" /> Relógios Genéricos
                </div>
                <p className="text-white/60 text-[9px] leading-relaxed">
                  Muitos modelos genéricos (Da Fit, etc ) não permitem conexão direta. Recomendamos o uso de uma <strong>cinta peitoral Bluetooth</strong>.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2 bg-primary text-black font-black uppercase text-[10px] rounded-lg"
            >
              Entendi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
