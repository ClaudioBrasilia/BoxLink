// src/components/HeartRateUnified.tsx
// Componente único de FC — BLE direto (nativo) + Web Bluetooth (web) + Health Connect (fallback nativo)
// Um único botão, na página inicial apenas.

import React, { useState } from 'react';
import {
  Heart, Bluetooth, BluetoothOff, Loader2, AlertCircle, X,
  Watch, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useHeartRate } from '../hooks/useHeartRate';
import { useBluetooth } from '../hooks/useBluetooth';
import { cn } from '../lib/utils';

interface Props { userId: string | undefined; className?: string; }

// ─── Zona de FC ───────────────────────────────────────────────────────────────
function getZone(bpm: number) {
  if (bpm < 100) return { label: 'REPOUSO',     color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   bar: 'bg-blue-400' };
  if (bpm < 120) return { label: 'AQUECIMENTO', color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  bar: 'bg-green-400' };
  if (bpm < 140) return { label: 'QUEIMA',      color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', bar: 'bg-yellow-400' };
  if (bpm < 160) return { label: 'AERÓBICO',    color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', bar: 'bg-orange-400' };
  return                { label: 'MÁXIMO',      color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    bar: 'bg-red-400' };
}

// ─── Dicas por dispositivo ───────────────────────────────────────────────────
const DEVICE_TIPS = [
  { name: 'Apple Watch', tip: 'Abra o app Heart Graph ou similar que transmita via Bluetooth no Watch.' },
  { name: 'Samsung / WearOS', tip: 'Certifique-se de que o relógio não está conectado a outro app de treino.' },
  { name: 'Cintas (Polar/Garmin)', tip: 'Umedeça os sensores e vista a cinta antes de iniciar a busca.' },
  { name: 'Relógios Genéricos', tip: 'Se o nome aparecer como "Watch", verifique o endereço (ex: 41:42) para confirmar o seu.' },
];

// ─── Versão Web (Web Bluetooth) ──────────────────────────────────────────────
function WebVersion({ userId, className }: Props) {
  const { bpm, status, errorMessage: error, connect: startReading, disconnect: stopReading, deviceName } = useHeartRate(userId);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const zone = bpm ? getZone(bpm) : null;

  return (
    <div className={cn("flex flex-col gap-4 p-4 bg-white/5 border border-white/10 rounded-3xl", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-2xl", isConnected ? "bg-primary/20" : "bg-white/5")}>
            <Heart className={cn("w-5 h-5", isConnected ? "text-primary animate-pulse" : "text-white/20")} />
          </div>
          <div>
            <h3 className="text-white text-xs font-black uppercase tracking-widest">Frequência Cardíaca</h3>
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Web Bluetooth</p>
          </div>
        </div>
        {isConnected && (
          <div className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-primary text-[8px] font-black uppercase">Conectado</span>
          </div>
        )}
      </div>

      {isConnected && bpm ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-1 justify-center py-2">
            <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{bpm}</span>
            <span className="text-white/40 text-xs font-black">BPM</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className={cn("text-[10px] font-black uppercase tracking-widest", zone?.color)}>{zone?.label}</span>
              <span className="text-white/20 text-[9px] font-black">{deviceName}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div className={cn("h-full", zone?.bar)} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (bpm/190)*100)}%` }} />
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-white/20 text-[10px] font-black uppercase leading-relaxed px-4">
            Conecte seu relógio ou cinta cardíaca para monitorar seu treino em tempo real
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-[10px] font-black uppercase leading-relaxed">{error}</p>
        </div>
      )}

      <button
        onClick={isConnected ? stopReading : startReading}
        disabled={isConnecting}
        className={cn(
          "flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
          isConnected
            ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
            : "bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]"
        )}
      >
        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : isConnected ? <X className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />}
        {isConnecting ? 'Conectando...' : isConnected ? 'Desconectar' : 'Parear Dispositivo'}
      </button>
    </div>
  );
}

// ─── Versão Nativa (BLE Direto) ──────────────────────────────────────────────
function NativeVersion({ userId, className }: Props) {
  const { devices, status, errorMessage: bleError, startScanning, connectDevice, disconnectDevice } = useBluetooth(userId);
  const [showTips, setShowTips] = useState(false);

  const connectedDevices = devices.filter(d => d.status === 'connected');
  const availableDevices = devices.filter(d => d.status === 'disconnected');
  const isScanning = status === 'scanning';
  const hasConnected = connectedDevices.length > 0;

  const mainDevice = connectedDevices[0];
  const zone = mainDevice?.bpm ? getZone(mainDevice.bpm) : null;

  return (
    <div className={cn("flex flex-col gap-4 p-4 bg-white/5 border border-white/10 rounded-3xl", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-2xl", hasConnected ? "bg-primary/20" : "bg-white/5")}>
            <Watch className={cn("w-5 h-5", hasConnected ? "text-primary animate-pulse" : "text-white/20")} />
          </div>
          <div>
            <h3 className="text-white text-xs font-black uppercase tracking-widest">Monitor Cardíaco</h3>
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Nativo · Bluetooth LE</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {hasConnected && mainDevice.bpm ? (
          <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-1 justify-center py-2">
              <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{mainDevice.bpm}</span>
              <span className="text-white/40 text-xs font-black">BPM</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", zone?.color)}>{zone?.label}</span>
                <span className="text-white/20 text-[9px] font-black">{mainDevice.name}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div className={cn("h-full", zone?.bar)} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (mainDevice.bpm/190)*100)}%` }} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center">
            <p className="text-white/20 text-[10px] font-black uppercase leading-relaxed px-4">
              Conecte seu relógio ou cinto cardíaco via Bluetooth
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispositivos múltiplos conectados */}
      {connectedDevices.length > 1 && (
        <div className="flex flex-col gap-2">
          {connectedDevices.map((d) => d.bpm && (
            <div key={d.id} className="flex items-center justify-between bg-green-400/5 border border-green-400/20 rounded-xl px-3 py-2">
              <span className="text-green-400 text-[10px] font-black uppercase">{d.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm">{d.bpm}</span>
                <span className="text-white/40 text-[9px]">BPM</span>
                <button onClick={() => disconnectDevice(d.id)} className="ml-1 text-red-400 hover:text-red-300">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de disponíveis ao escanear */}
      {isScanning && availableDevices.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-yellow-400 text-[9px] font-black uppercase tracking-widest">Disponíveis ({availableDevices.length})</p>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-2">
            {availableDevices.map((d) => (
              <button key={d.id} onClick={() => connectDevice(d.id)}
                className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 rounded-xl p-3 text-left transition-colors flex flex-col gap-1">
                <p className="text-xs font-black text-white">{d.name}</p>
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">ID: {d.id}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Erro */}
      {bleError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-[10px] font-black uppercase leading-relaxed">{bleError}</p>
        </div>
      )}

      {/* Botão único */}
      {hasConnected ? (
        <button onClick={() => connectedDevices.forEach((d) => disconnectDevice(d.id))}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Desconectar
        </button>
      ) : (
        <button onClick={isScanning ? undefined : startScanning} disabled={isScanning}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(202,253,0,0.2)] disabled:opacity-60 disabled:scale-100",
            isScanning ? "bg-white/10 text-white/40" : "bg-primary text-black"
          )}>
          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
          {isScanning ? 'Buscando dispositivos...' : 'Iniciar Leitura de FC'}
        </button>
      )}

      {/* Dicas */}
      {!hasConnected && (
        <div>
          <button onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-1 text-white/30 text-[9px] font-black uppercase tracking-widest hover:text-white/50 transition-colors w-full justify-center">
            {showTips ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showTips ? 'Ocultar dicas' : 'Dicas por dispositivo'}
          </button>
          <AnimatePresence>
            {showTips && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2 flex flex-col gap-2">
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

      <div className="flex items-center gap-1.5 text-white/20 text-[8px] font-black uppercase tracking-widest justify-center">
        <Zap className="w-2.5 h-2.5" />
        Polar · Garmin · Wahoo · Samsung · Amazfit · Apple Watch
      </div>
    </div>
  );
}

// ─── Componente principal — detecta ambiente automaticamente ──────────────────
export default function HeartRateUnified({ userId, className }: Props) {
  const isNative = Capacitor.isNativePlatform();
  return isNative
    ? <NativeVersion userId={userId} className={className} />
    : <WebVersion    userId={userId} className={className} />;
}
