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
  if (bpm < 140) return { label: 'AERÓBICO',    color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', bar: 'bg-yellow-400' };
  if (bpm < 160) return { label: 'ANAERÓBICO',  color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', bar: 'bg-orange-400' };
  return               { label: 'MÁXIMO ⚡',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    bar: 'bg-red-400' };
}
function intensityPct(bpm: number) { return Math.min(100, Math.max(0, ((bpm - 50) / 150) * 100)); }

function BpmDisplay({ bpm, label }: { bpm: number; label: string }) {
  const zone = getZone(bpm);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-2xl border p-4 flex flex-col items-center gap-2', zone.bg, zone.border)}>
      <div className="flex items-end gap-1">
        <span className={cn('text-6xl font-black italic tabular-nums', zone.color)}>{bpm}</span>
        <span className={cn('text-lg font-black uppercase pb-2', zone.color)}>BPM</span>
      </div>
      <span className={cn('text-xs font-black uppercase tracking-[0.3em] italic', zone.color)}>ZONA: {zone.label}</span>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <motion.div className={`h-full rounded-full ${zone.bar}`}
          animate={{ width: `${intensityPct(bpm)}%` }} transition={{ duration: 0.5 }} />
      </div>
      <div className="flex items-center gap-1 text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">
        <Bluetooth className="w-2.5 h-2.5" />{label}
      </div>
    </motion.div>
  );
}

// Dicas por dispositivo
const DEVICE_TIPS = [
  { name: 'Polar H10 / H9',      tip: 'Molhe os eletrodos antes de colocar. Aparece automaticamente.' },
  { name: 'Garmin HRM-Pro/Dual', tip: 'Coloque o cinto e molhe os eletrodos. Aparece na lista.' },
  { name: 'Garmin (relógio)',     tip: 'Inicie uma atividade → Configurações → Transmitir FC.' },
  { name: 'Wahoo TICKR',         tip: 'Coloque o cinto. Aparece como "TICKR" automaticamente.' },
  { name: 'Mi Band / Amazfit',   tip: 'Desconecte do Mi Fitness antes de conectar aqui.' },
  { name: 'Samsung Galaxy Watch', tip: 'No app Galaxy Wearable, ative "Transmissão de FC".' },
];

// ─── Versão WEB — Web Bluetooth API ───────────────────────────────────────────
function WebVersion({ userId, className }: Props) {
  const { bpm, status, deviceName, errorMessage, connect, disconnect, isSupported } = useHeartRate(userId);
  const [showTips, setShowTips] = useState(false);
  const active = status === 'connected';

  return (
    <div className={cn('bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={cn('w-5 h-5', active ? 'text-red-400 animate-pulse' : 'text-white/30')} />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Frequência Cardíaca</h3>
        </div>
        <div className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider',
          active ? 'text-green-400' : status === 'error' ? 'text-red-400'
          : status === 'connecting' ? 'text-yellow-400' : 'text-white/30')}>
          {status === 'connecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
          <span>{active ? 'CONECTADO' : status === 'connecting' ? 'BUSCANDO...' : status === 'error' ? 'ERRO' : 'DESCONECTADO'}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {active && bpm ? (
          <BpmDisplay key="bpm" bpm={bpm} label={deviceName ?? 'Bluetooth'} />
        ) : status === 'connecting' ? (
          <motion.div key="conn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
            <p className="text-yellow-400 text-xs font-black uppercase tracking-widest text-center">
              Selecione seu dispositivo na janela do navegador
            </p>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-2">
            <BluetoothOff className="w-8 h-8 text-white/20" />
            <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
              {isSupported ? 'Conecte seu relógio ou cinto cardíaco' : 'Use Chrome ou Edge para conectar via Bluetooth'}
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

      {active ? (
        <button onClick={disconnect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Desconectar
        </button>
      ) : status !== 'connecting' && (
        <button onClick={connect} disabled={!isSupported}
          className={cn('flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
            isSupported
              ? 'bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10')}>
          <Heart className="w-4 h-4" />
          {isSupported ? 'Iniciar Leitura de FC' : 'Use Chrome ou Edge'}
        </button>
      )}

      {!active && isSupported && (
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
    </div>
  );
}

// ─── Versão NATIVA — BLE via Capacitor (primário) ─────────────────────────────
function NativeVersion({ userId, className }: Props) {
  const { devices, status: bleStatus, errorMessage: bleError, startScanning, connectDevice, disconnectDevice } = useBluetooth(userId);
  const [showTips, setShowTips] = useState(false);

  const connectedDevices = devices.filter((d) => d.status === 'connected');
  const availableDevices = devices.filter((d) => d.status === 'disconnected');
  const primaryBpm       = connectedDevices[0]?.bpm ?? null;
  const isScanning       = bleStatus === 'scanning';
  const hasConnected     = connectedDevices.length > 0;

  return (
    <div className={cn('bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={cn('w-5 h-5', hasConnected ? 'text-red-400 animate-pulse' : 'text-white/30')} />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Frequência Cardíaca</h3>
        </div>
        <div className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider',
          hasConnected ? 'text-green-400' : isScanning ? 'text-yellow-400' : 'text-white/30')}>
          {isScanning
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Bluetooth className="w-3.5 h-3.5" />}
          <span>
            {hasConnected ? `${connectedDevices.length} CONECTADO${connectedDevices.length > 1 ? 'S' : ''}`
              : isScanning ? 'BUSCANDO...' : 'DESCONECTADO'}
          </span>
        </div>
      </div>

      {/* BPM principal */}
      <AnimatePresence mode="wait">
        {hasConnected && primaryBpm ? (
          <BpmDisplay key="bpm" bpm={primaryBpm} label={connectedDevices[0].name} />
        ) : isScanning && availableDevices.length === 0 ? (
          <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
            <p className="text-yellow-400 text-xs font-black uppercase tracking-widest text-center">
              Procurando dispositivos BLE...
            </p>
          </motion.div>
        ) : !hasConnected && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-2">
            <Watch className="w-8 h-8 text-white/20" />
            <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
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
                className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 rounded-xl p-2 text-left transition-colors">
                <p className="text-xs font-black text-white">{d.name}</p>
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
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(202,253,0,0.2)] disabled:opacity-60 disabled:scale-100">
          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
          {isScanning ? 'Buscando...' : 'Iniciar Leitura de FC'}
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
