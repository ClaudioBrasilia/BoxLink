// src/components/HeartRateWidget.tsx
// ============================================================================
// Widget UNIFICADO de Frequência Cardíaca.
//   1. Conexão Direta (Bluetooth LE) — baixa latência, relógio/cinto.
//   2. Sincronizar com App de Saúde (Apple Health / Health Connect) — fallback.
// Detecta o ambiente (nativo x web) e deixa o usuário escolher o modo.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Heart, Bluetooth, BluetoothOff, Loader2, AlertCircle, X, Watch,
  ChevronDown, ChevronUp, Zap, RefreshCw, Settings, ArrowLeft, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useBluetooth } from '../hooks/useBluetooth';
import { useNativeHealth } from '../hooks/useNativeHealth';
import { useHeartRateSession } from '../hooks/useHeartRateSession';
import { useUserBiometrics } from '../hooks/useUserBiometrics';
import HeartRateSummary from './HeartRateSummary';
import { getHeartRateZone, intensityPct } from '../lib/heartRate';
import { cn } from '../lib/utils';

const MIN_SUMMARY_SAMPLES = 2;

interface Props { userId: string | undefined; className?: string; }

type Mode = 'select' | 'ble' | 'health';

const DEVICE_TIPS: { name: string; tip: string }[] = [
  { name: 'Garmin (relógio)',    tip: 'Inicie uma atividade → Configurações → Transmitir FC. Depois busque aqui.' },
  { name: 'Polar H10 / H9',      tip: 'Umedeça os eletrodos antes de vestir. Aparece como "Polar H10".' },
  { name: 'Wahoo TICKR',         tip: 'Vista o cinto. Aparece automaticamente como "TICKR".' },
  { name: 'Huawei / Xiaomi',     tip: 'Relógios genéricos usam UUID proprietário (0x3802) — já suportado.' },
  { name: 'Mi Band / Amazfit',   tip: 'Não deixe conectado ao app Mi Fitness / Zepp ao mesmo tempo.' },
];

// ─── Exibição do BPM + zona ──────────────────────────────────────────────────
function BpmDisplay({ bpm, deviceName, waitingLabel }: { bpm: number | null; deviceName?: string | null; waitingLabel: string }) {
  if (!bpm) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="rounded-2xl bg-green-400/5 border border-green-400/20 p-6 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
        <p className="text-green-400 text-xs font-black uppercase tracking-widest text-center">{waitingLabel}</p>
        {deviceName && (
          <div className="flex items-center gap-1 text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">
            <Activity className="w-2.5 h-2.5" />{deviceName}
          </div>
        )}
      </motion.div>
    );
  }

  const zone = getHeartRateZone(bpm);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-2xl border p-4 flex flex-col items-center gap-2', zone.bg, zone.border)}>
      <div className="flex items-end gap-1">
        <span className={cn('text-6xl font-black italic tabular-nums', zone.color)}>{bpm}</span>
        <span className={cn('text-lg font-black uppercase pb-2', zone.color)}>BPM</span>
      </div>
      <span className={cn('text-xs font-black uppercase tracking-[0.3em] italic', zone.color)}>ZONA: {zone.label}</span>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <motion.div className={cn('h-full rounded-full', zone.bar)}
          animate={{ width: `${intensityPct(bpm)}%` }} transition={{ duration: 0.5 }} />
      </div>
      {deviceName && (
        <div className="flex items-center gap-1 text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">
          <Activity className="w-2.5 h-2.5" />{deviceName}
        </div>
      )}
    </motion.div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-red-400 text-[10px] font-black uppercase leading-relaxed">{message}</p>
    </div>
  );
}

function DeviceTips() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-white/30 text-[9px] font-black uppercase tracking-widest hover:text-white/50 transition-colors w-full justify-center">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Ocultar dicas' : 'Dicas por dispositivo'}
      </button>
      <AnimatePresence>
        {open && (
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
  );
}

// ─── Tela de seleção de modo (apenas nativo) ─────────────────────────────────
function ModeSelector({ onPick, platform }: { onPick: (m: Mode) => void; platform: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center">
        Como deseja monitorar sua FC?
      </p>

      <button onClick={() => onPick('ble')}
        className="group flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
        <div className="p-2.5 rounded-xl bg-primary/10"><Bluetooth className="w-5 h-5 text-primary" /></div>
        <div className="flex-1">
          <p className="text-white text-xs font-black uppercase tracking-widest">Conexão Direta</p>
          <p className="text-white/40 text-[9px] font-black uppercase tracking-wider mt-0.5">Relógio ou cinto · baixa latência</p>
        </div>
        <Zap className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
      </button>

      <button onClick={() => onPick('health')}
        className="group flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
        <div className="p-2.5 rounded-xl bg-primary/10"><Watch className="w-5 h-5 text-primary" /></div>
        <div className="flex-1">
          <p className="text-white text-xs font-black uppercase tracking-widest">Sincronizar com App de Saúde</p>
          <p className="text-white/40 text-[9px] font-black uppercase tracking-wider mt-0.5">
            {platform === 'ios' ? 'Apple Health · Samsung/Garmin/Apple' : 'Health Connect · Samsung/Garmin/Fitbit'}
          </p>
        </div>
        <RefreshCw className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
      </button>
    </div>
  );
}

// ─── Modo: Conexão Direta (Bluetooth LE) ─────────────────────────────────────
function BleMode({ userId, onFallback, canFallback }: { userId?: string; onFallback: () => void; canFallback: boolean }) {
  const { status, error, devices, connectedDevice, heartRate, scan, stopScan, connect, disconnect, isSupported, isIOSWeb } =
    useBluetooth(userId);
  const [hasScanned, setHasScanned] = useState(false);
  const [finished, setFinished] = useState(false);

  const isScanning = status === 'scanning';
  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';

  const { samples, reset } = useHeartRateSession(heartRate, isConnected);
  const bio = useUserBiometrics(userId);

  useEffect(() => {
    if (isScanning) setHasScanned(true);
  }, [isScanning]);

  // Mostra o resumo quando a sessão conectada termina (clique OU queda do sinal).
  const wasConnected = useRef(false);
  useEffect(() => {
    if (wasConnected.current && !isConnected && samples.length >= MIN_SUMMARY_SAMPLES) {
      setFinished(true);
    }
    wasConnected.current = isConnected;
  }, [isConnected, samples.length]);

  const emptyAfterScan = hasScanned && !isScanning && !isConnected && devices.length === 0;

  const closeSummary = () => {
    setFinished(false);
    reset();
  };

  // Resumo de treino ao encerrar
  if (finished && samples.length >= MIN_SUMMARY_SAMPLES) {
    return <HeartRateSummary samples={samples} deviceName={connectedDevice?.name} bio={bio} onClose={closeSummary} />;
  }

  if (isConnected) {
    return (
      <div className="flex flex-col gap-4">
        <BpmDisplay bpm={heartRate} deviceName={connectedDevice?.name} waitingLabel="Conectado — aguardando leitura de FC..." />
        {error && <ErrorBox message={error} />}
        <button onClick={disconnect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Encerrar e ver resumo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lista de dispositivos encontrados */}
      {(isScanning || devices.length > 0) && !isConnecting && (
        <div className="flex flex-col gap-2">
          <p className="text-yellow-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            {isScanning && <Loader2 className="w-3 h-3 animate-spin" />}
            {isScanning ? 'Buscando...' : `Encontrados (${devices.length})`}
          </p>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-2">
            {devices.map((d) => (
              <button key={d.id} onClick={() => connect(d.id)}
                className={cn('rounded-xl p-3 text-left transition-colors flex items-center justify-between gap-2 border',
                  d.hasHeartRateService
                    ? 'bg-primary/10 border-primary/30 hover:bg-primary/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10')}>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">{d.name}</p>
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest truncate">
                    {d.hasHeartRateService ? '❤ Monitor cardíaco' : `ID ${d.id.slice(-8)}`}
                  </p>
                </div>
                {typeof d.rssi === 'number' && (
                  <span className="text-[8px] font-black text-white/30 shrink-0">{d.rssi} dBm</span>
                )}
              </button>
            ))}
            {isScanning && devices.length === 0 && (
              <p className="text-white/30 text-[10px] font-black uppercase text-center py-4">Procurando dispositivos próximos...</p>
            )}
          </div>
        </div>
      )}

      {isConnecting && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
          <p className="text-yellow-400 text-xs font-black uppercase tracking-widest text-center">Conectando ao dispositivo...</p>
        </motion.div>
      )}

      {!isScanning && !isConnecting && devices.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-2">
          <BluetoothOff className="w-8 h-8 text-white/20" />
          <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
            {isSupported
              ? 'Conecte seu relógio ou cinto cardíaco'
              : isIOSWeb
                ? 'iPhone: abra o BoxLink pelo navegador Bluefy (App Store) para conectar via Bluetooth'
                : 'Use o app instalado, Chrome ou Edge para conectar'}
          </p>
        </motion.div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Fallback automático quando o scan não acha nada */}
      {emptyAfterScan && canFallback && (
        <button onClick={onFallback}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Não achou? Sincronizar via App de Saúde
        </button>
      )}

      {/* Botão principal */}
      {isScanning ? (
        <button onClick={stopScan}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" /> Parar Busca
        </button>
      ) : !isConnecting && (
        <button onClick={scan} disabled={!isSupported}
          className={cn('flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
            isSupported
              ? 'bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10')}>
          <Bluetooth className="w-4 h-4" />
          {devices.length > 0 ? 'Buscar Novamente' : 'Buscar Dispositivos'}
        </button>
      )}

      {isSupported && <DeviceTips />}
    </div>
  );
}

// ─── Modo: App de Saúde (HealthKit / Health Connect) ─────────────────────────
function HealthMode({ userId, platform }: { userId?: string; platform: string }) {
  const { bpm, status, errorMessage, startReading, stopReading, openSettings, isAvailablePlatform } =
    useNativeHealth(userId);

  const appName = platform === 'ios' ? 'Apple Health' : 'Health Connect';
  const isActive = status === 'active';
  const isRequesting = status === 'requesting';

  const [finished, setFinished] = useState(false);
  const { samples, reset } = useHeartRateSession(bpm, isActive);
  const bio = useUserBiometrics(userId);

  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !isActive && samples.length >= MIN_SUMMARY_SAMPLES) {
      setFinished(true);
    }
    wasActive.current = isActive;
  }, [isActive, samples.length]);

  const closeSummary = () => {
    setFinished(false);
    reset();
  };

  if (finished && samples.length >= MIN_SUMMARY_SAMPLES) {
    return <HeartRateSummary samples={samples} deviceName={appName} bio={bio} onClose={closeSummary} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {isActive ? (
        <BpmDisplay bpm={bpm} deviceName={appName} waitingLabel={`Lendo do ${appName}... aguardando sincronização`} />
      ) : isRequesting ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
          <p className="text-yellow-400 text-xs font-black uppercase text-center">Solicitando permissão ao {appName}...</p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col items-center gap-2">
          <Watch className="w-8 h-8 text-white/20" />
          <p className="text-white/40 text-xs font-black uppercase tracking-wider text-center">
            {platform === 'ios'
              ? 'Lê direto do Apple Health — funciona com qualquer relógio'
              : 'Lê do Health Connect — Samsung, Garmin, Fitbit, Amazfit e outros'}
          </p>
        </motion.div>
      )}

      {errorMessage && <ErrorBox message={errorMessage} />}

      {isActive ? (
        <button onClick={stopReading}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Encerrar e ver resumo
        </button>
      ) : !isRequesting && (
        <button onClick={startReading} disabled={!isAvailablePlatform}
          className={cn('flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
            isAvailablePlatform
              ? 'bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10')}>
          <Heart className="w-4 h-4" /> Iniciar Leitura de FC
        </button>
      )}

      {status === 'error' && platform === 'android' && (
        <button onClick={openSettings}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
          <Settings className="w-3.5 h-3.5" /> Abrir configurações do Health Connect
        </button>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function HeartRateWidget({ userId, className }: Props) {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // Na web só há conexão direta (Web Bluetooth). No nativo, o usuário escolhe.
  const [mode, setMode] = useState<Mode>(isNative ? 'select' : 'ble');

  const statusLabel = useMemo(() => {
    if (mode === 'select') return 'ESCOLHA';
    return mode === 'ble' ? 'DIRETO' : 'APP SAÚDE';
  }, [mode]);

  return (
    <div className={cn('bg-[#111] rounded-3xl border border-white/5 p-5 flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode !== 'select' && isNative && (
            <button onClick={() => setMode('select')} className="p-1 -ml-1 rounded-lg hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/40" />
            </button>
          )}
          <Heart className="w-5 h-5 text-white/30" />
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Frequência Cardíaca</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white/30">
          {mode === 'health' ? <Watch className="w-3.5 h-3.5" /> : <Bluetooth className="w-3.5 h-3.5" />}
          <span>{statusLabel}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {mode === 'select' && <ModeSelector platform={platform} onPick={setMode} />}
          {mode === 'ble' && (
            <BleMode userId={userId} canFallback={isNative} onFallback={() => setMode('health')} />
          )}
          {mode === 'health' && <HealthMode userId={userId} platform={platform} />}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-1.5 text-white/20 text-[8px] font-black uppercase tracking-widest justify-center">
        <Zap className="w-2.5 h-2.5" />
        Polar · Garmin · Wahoo · Samsung · Amazfit · Huawei · Xiaomi · Apple
      </div>
    </div>
  );
}
