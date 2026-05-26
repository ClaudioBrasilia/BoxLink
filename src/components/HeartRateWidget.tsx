// src/components/HeartRateWidget.tsx
import React, { useState } from 'react';
import { Heart, Bluetooth, BluetoothOff, Loader2, AlertCircle, X, Watch, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useHeartRate } from '../hooks/useHeartRate';
import { useNativeHealth } from '../hooks/useNativeHealth';
import { cn } from '../lib/utils';

interface Props { userId: string | undefined; className?: string; }

function getZone(bpm: number) {
  if (bpm < 100) return { label: 'REPOUSO',     color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   bar: 'bg-blue-400' };
  if (bpm < 120) return { label: 'AQUECIMENTO', color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  bar: 'bg-green-400' };
  if (bpm < 140) return { label: 'AERÓBICO',    color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', bar: 'bg-yellow-400' };
  if (bpm < 160) return { label: 'ANAERÓBICO',  color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', bar: 'bg-orange-400' };
  return               { label: 'MÁXIMO ⚡',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    bar: 'bg-red-400' };
}

function intensityPct(bpm: number) {
  return Math.min(100, Math.max(0, ((bpm - 50) / 150) * 100));
}

// Instruções por marca de dispositivo
const DEVICE_TIPS: { name: string; tip: string }[] = [
  { name: 'Garmin (relógio)',   tip: 'Inicie uma atividade no relógio → Configurações → Transmitir FC → depois conecte aqui.' },
  { name: 'Garmin HRM-Pro/Dual', tip: 'Coloque o cinto, molhe os eletrodos. Ele aparece na lista automaticamente.' },
  { name: 'Polar H10 / H9',    tip: 'Molhe os eletrodos antes de colocar. Deve aparecer como "Polar H10" ou "Polar H9".' },
  { name: 'Wahoo TICKR',       tip: 'Coloque o cinto. Aparece automaticamente como "TICKR".' },
  { name: 'Mi Band / Amazfit', tip: 'Certifique-se que não está conectado ao app Mi Fitness ao mesmo tempo.' },
];

function BpmDisplay({ bpm, deviceName }: { bpm: number | null; deviceName: string | null }) {
  const zone = bpm ? getZone(bpm) : null;
  if (!bpm) return null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-2xl border p-4 flex flex-col items-center gap-2', zone?.bg, zone?.border)}>
      <div className="flex items-end gap-1">
        <span className={cn('text-6xl font-black italic tabular-nums', zone?.color)}>{bpm}</span>
        <span className={cn('text-lg font-black uppercase pb-2', zone?.color)}>BPM</span>
      </div>
      <span className={cn('text-xs font-black uppercase tracking-[0.3em] italic', zone?.color)}>ZONA: {zone?.label}</span>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <motion.div className={`h-full rounded-full ${zone?.bar}`}
          animate={{ width: `${intensityPct(bpm)}%` }} transition={{ duration: 0.5 }} />
      </div>
      {deviceName && (
        <div className="flex items-center gap-1 text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">
          <Bluetooth className="w-2.5 h-2.5" />{deviceName}
        </div>
      )}
    </motion.div>
  );
}

// Widget Web (Bluetooth direto)
function WebBluetoothWidget({ userId, className }: Props) {
  const { bpm, status, deviceName, errorMessage, connect, disconnect, isSupported } = useHeartRate(userId);
  const [showTips, setShowTips] = useState(false);

  return (
    <div className={cn('bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={cn('w-5 h-5', status === 'connected' ? 'text-red-400 animate-pulse' : 'text-white/30')} />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Frequência Cardíaca</h3>
        </div>
        <div className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider',
          status === 'connected' ? 'text-green-400' : status === 'error' ? 'text-red-400'
          : status === 'connecting' ? 'text-yellow-400' : 'text-white/30')}>
          {status === 'connecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
          <span>{status === 'connected' ? 'CONECTADO' : status === 'connecting' ? 'BUSCANDO...' : status === 'error' ? 'ERRO' : 'DESCONECTADO'}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'connected' && bpm ? (
          <BpmDisplay key="bpm" bpm={bpm} deviceName={deviceName} />
        ) : status === 'connecting' ? (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
            <p className="text-yellow-400 text-xs font-black uppercase tracking-widest text-center">Selecione seu dispositivo na janela do navegador</p>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-2">
            <BluetoothOff className="w-8 h-8 text-white/20" />
            <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
              {isSupported ? 'Conecte seu relógio ou cinto cardíaco' : 'Use Chrome ou Edge para conectar'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMessage && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-[10px] font-black uppercase leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {status === 'connected' ? (
        <button onClick={disconnect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Desconectar
        </button>
      ) : status !== 'connecting' && (
        <button onClick={connect} disabled={!isSupported}
          className={cn('flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
            isSupported ? 'bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10')}>
          <Bluetooth className="w-4 h-4" />
          {isSupported ? 'Conectar Relógio / Cinto' : 'Use Chrome ou Edge'}
        </button>
      )}

      {/* Dicas por dispositivo */}
      {status !== 'connected' && isSupported && (
        <div>
          <button onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-1 text-white/30 text-[9px] font-black uppercase tracking-widest hover:text-white/50 transition-colors w-full justify-center">
            {showTips ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showTips ? 'Ocultar dicas' : 'Dicas por dispositivo'}
          </button>
          <AnimatePresence>
            {showTips && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-2 flex flex-col gap-2">
                {DEVICE_TIPS.map((d) => (
                  <div key={d.name} className="bg-white/5 rounded-xl p-3">
                    <p className="text-primary text-[9px] font-black uppercase tracking-widest mb-1">{d.name}</p>
                    <p className="text-white/50 text-[9px] leading-relaxed">{d.tip}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Widget Nativo (HealthKit / Health Connect)
function NativeWidget({ userId, className }: Props) {
  const { bpm, status, errorMessage, startReading, stopReading } = useNativeHealth(userId);
  const platform = Capacitor.getPlatform();

  return (
    <div className={cn('bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={cn('w-5 h-5', status === 'active' ? 'text-red-400 animate-pulse' : 'text-white/30')} />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Frequência Cardíaca</h3>
        </div>
        <div className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider',
          status === 'active' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-white/30')}>
          <Watch className="w-3.5 h-3.5" />
          <span>{status === 'active' ? 'LENDO' : status === 'requesting' ? 'AGUARDE' : 'INATIVO'}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'active' && bpm ? (
          <BpmDisplay key="bpm" bpm={bpm} deviceName={platform === 'ios' ? 'Apple Health' : 'Health Connect'} />
        ) : status === 'requesting' ? (
          <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
            <p className="text-yellow-400 text-xs font-black uppercase text-center">
              Solicitando permissão ao {platform === 'ios' ? 'Apple Health' : 'Health Connect'}...
            </p>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col items-center gap-2">
            <Watch className="w-8 h-8 text-white/20" />
            <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
              {platform === 'ios'
                ? 'Lê direto do Apple Health — funciona com qualquer relógio'
                : 'Lê do Health Connect — funciona com Samsung, Garmin, Fitbit e outros'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMessage && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-[10px] font-black uppercase leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {status === 'active' ? (
        <button onClick={stopReading}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Parar Leitura
        </button>
      ) : status !== 'requesting' && (
        <button onClick={startReading}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(202,253,0,0.2)]">
          <Heart className="w-4 h-4" /> Iniciar Leitura de FC
        </button>
      )}
    </div>
  );
}

// Componente principal — detecta automaticamente o ambiente
export default function HeartRateWidget({ userId, className }: Props) {
  const isNative = Capacitor.isNativePlatform();
  return isNative
    ? <NativeWidget userId={userId} className={className} />
    : <WebBluetoothWidget userId={userId} className={className} />;
}
