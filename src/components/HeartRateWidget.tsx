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
  Globe, Copy, Check, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useBluetooth } from '../hooks/useBluetooth';
import { useNativeHealth } from '../hooks/useNativeHealth';
import { useHeartRateSession } from '../hooks/useHeartRateSession';
import { useKeepScreenAwake } from '../hooks/useKeepScreenAwake';
import { useUserBiometrics } from '../hooks/useUserBiometrics';
import HeartRateSummary from './HeartRateSummary';
import { getHeartRateZone, intensityPct } from '../lib/heartRate';
import { cn } from '../lib/utils';

const MIN_SUMMARY_SAMPLES = 2;

interface Props { userId: string | undefined; className?: string; }

type Mode = 'select' | 'ble' | 'health';

const DEVICE_TIPS: { name: string; tip: string }[] = [
  { name: 'Polar / Wahoo / cintas',   tip: 'Umedeça os eletrodos antes de vestir. Aparecem como "Polar H10", "TICKR" etc.' },
  { name: 'Garmin (relógio)',         tip: 'Inicie uma atividade → Configurações → Transmitir FC. Depois busque aqui.' },
  { name: 'Samsung Galaxy Watch',     tip: 'Não transmite FC por Bluetooth direto. Use "Sincronizar com App de Saúde" (Health Connect) ou instale um app transmissor no relógio (ex.: "Heart for Bluetooth").' },
  { name: 'Samsung Galaxy Fit (pulseira)', tip: 'Conecta direto: inicie um treino NA PULSEIRA (medição contínua de FC) e busque aqui. Se falhar, feche o app Galaxy Wearable — conectada ao celular, ela recusa o BoxLink.' },
  { name: 'iPhone (navegador)',       tip: 'Safari e Chrome do iPhone não têm Bluetooth. Abra o BoxLink pelo navegador Bluefy (grátis na App Store) para conectar sem o app nativo.' },
  { name: 'Apple Watch',              tip: 'Não transmite FC por Bluetooth. Use "Sincronizar com App de Saúde" (Apple Health) ou um app broadcaster (ex.: HeartCast) aberto no Bluefy.' },
  { name: 'Huawei / Xiaomi / genéricos', tip: 'Muitos usam UUID proprietário (0x3802) — já suportado. Se aparecer só como "Watch", confira pelo endereço/RSSI.' },
  { name: 'Mi Band / Amazfit',        tip: 'Não deixe conectado ao app Mi Fitness / Zepp ao mesmo tempo.' },
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

// Detecta relógios Garmin pelo nome (transmitem FC só no modo "Transmitir FC").
function isGarminName(name?: string | null): boolean {
  if (!name) return false;
  return /garmin|forerunner|fenix|f[eé]nix|venu|vivoactive|vivosmart|instinct|epix|enduro|swim|marq|descent|approach/i.test(name);
}

// Dica específica para Garmin ao falhar a leitura de FC.
function GarminHint() {
  return (
    <div className="flex flex-col gap-1.5 bg-primary/5 border border-primary/20 rounded-xl p-3">
      <p className="text-primary text-[9px] font-black uppercase tracking-widest">Garmin detectado</p>
      <p className="text-white/60 text-[9px] font-black uppercase leading-relaxed">
        O Garmin só envia a FC no modo <span className="text-white">"Transmitir FC"</span>:
      </p>
      <ol className="text-white/50 text-[9px] font-black uppercase leading-relaxed list-decimal pl-3.5 flex flex-col gap-0.5">
        <li>Desconecte o relógio do celular/Garmin Connect (ele transmite p/ 1 aparelho por vez).</li>
        <li>No relógio: Configurações → Sensores → FC no pulso → <span className="text-white">Transmitir FC</span> (ou inicie um treino).</li>
        <li>Com o relógio no pulso, toque em "Buscar Novamente".</li>
      </ol>
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

// ─── Guia para iPhone na web (Apple bloqueia Web Bluetooth no WebKit) ────────
const BLUEFY_APP_STORE_URL = 'https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055';

function IOSWebGuide() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      // Copia só a raiz do site: links com rota interna (ex.: /dashboard)
      // dependem do fallback de SPA do servidor e podem dar 404.
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard indisponível — o usuário pode copiar pela barra de endereço */
    }
  };

  const steps = [
    'Baixe o navegador Bluefy (grátis) na App Store',
    'Copie o link do BoxLink e abra no Bluefy',
    'Toque em "Buscar Dispositivos" e conecte seu monitor',
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-primary" />
        <p className="text-white text-xs font-black uppercase tracking-widest">Bluetooth no iPhone</p>
      </div>

      <p className="text-white/50 text-[10px] leading-relaxed">
        A Apple bloqueia o Bluetooth em todos os navegadores do iPhone (Safari, Chrome, Edge...).
        Para conectar seu monitor de FC, use o navegador gratuito{' '}
        <span className="text-primary font-black">Bluefy</span>:
      </p>

      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-black flex items-center justify-center">
              {i + 1}
            </span>
            <p className="text-white/60 text-[10px] font-bold leading-relaxed pt-0.5">{step}</p>
          </div>
        ))}
      </div>

      <a href={BLUEFY_APP_STORE_URL} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(202,253,0,0.2)]">
        <ExternalLink className="w-4 h-4" /> Baixar Bluefy na App Store
      </a>

      <button onClick={copyLink}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Link copiado!' : 'Copiar link do BoxLink'}
      </button>

      <p className="text-white/30 text-[9px] leading-relaxed text-center">
        Tem Apple Watch? Instale um app transmissor no relógio (ex.: HeartCast) e conecte pelo Bluefy.
      </p>
    </motion.div>
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
  const {
    status, error, devices, connectedDevice, lastDevice, heartRate,
    scan, stopScan, connect, disconnect, isSupported, isIOSWeb, isNative,
  } = useBluetooth(userId);
  const [hasScanned, setHasScanned] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showAllDevices, setShowAllDevices] = useState(false);

  const isScanning = status === 'scanning';
  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';
  const isReconnecting = status === 'reconnecting';
  // Sessão segue ativa durante a auto-reconexão — queda de sinal não encerra o treino.
  const isSessionActive = isConnected || isReconnecting;

  const { samples, reset, startedAt } = useHeartRateSession(heartRate, isSessionActive);
  useKeepScreenAwake(isSessionActive); // não deixa a tela dormir durante o treino
  const bio = useUserBiometrics(userId);

  useEffect(() => {
    if (isScanning) setHasScanned(true);
  }, [isScanning]);

  // Mostra o resumo quando a sessão conectada termina (clique OU queda do sinal
  // sem conseguir reconectar).
  const wasConnected = useRef(false);
  useEffect(() => {
    if (wasConnected.current && !isSessionActive && samples.length >= MIN_SUMMARY_SAMPLES) {
      setFinished(true);
    }
    wasConnected.current = isSessionActive;
  }, [isSessionActive, samples.length]);

  const emptyAfterScan = hasScanned && !isScanning && !isConnected && devices.length === 0;

  const closeSummary = () => {
    setFinished(false);
    reset();
  };

  // Resumo de treino ao encerrar
  if (finished && samples.length >= MIN_SUMMARY_SAMPLES) {
    return <HeartRateSummary samples={samples} deviceName={connectedDevice?.name} bio={bio} startedAt={startedAt} persist userId={userId} source="ble" onClose={closeSummary} />;
  }

  if (isSessionActive) {
    return (
      <div className="flex flex-col gap-4">
        {isReconnecting ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-yellow-400/5 border border-yellow-400/20 p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            <p className="text-yellow-400 text-xs font-black uppercase tracking-widest text-center">
              Sinal perdido — reconectando{connectedDevice?.name ? ` a ${connectedDevice.name}` : ''}...
            </p>
            <p className="text-white/30 text-[9px] font-black uppercase tracking-widest text-center">
              Seu treino continua sendo registrado
            </p>
          </motion.div>
        ) : (
          <BpmDisplay bpm={heartRate} deviceName={connectedDevice?.name} waitingLabel="Conectado — aguardando leitura de FC..." />
        )}
        {error && <ErrorBox message={error} />}
        <button onClick={disconnect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          <X className="w-4 h-4" /> Encerrar e ver resumo
        </button>
      </div>
    );
  }

  // iPhone no navegador comum: sem Web Bluetooth (bloqueio da Apple no WebKit).
  // Mostra o passo a passo do Bluefy em vez de um botão desabilitado.
  if (isIOSWeb && !isSupported) {
    return <IOSWebGuide />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lista de dispositivos encontrados (prováveis monitores de FC por
          padrão; toggle exibe também TVs/fones/celulares ao redor) */}
      {(isScanning || devices.length > 0) && !isConnecting && (() => {
        const visibleDevices = showAllDevices ? devices : devices.filter((d) => d.likelyHR);
        const hiddenCount = devices.length - visibleDevices.length;
        return (
          <div className="flex flex-col gap-2">
            <p className="text-yellow-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
              {isScanning && <Loader2 className="w-3 h-3 animate-spin" />}
              {isScanning ? 'Buscando...' : `Encontrados (${visibleDevices.length})`}
            </p>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-2">
              {visibleDevices.map((d) => (
                <button key={d.id} onClick={() => connect(d.id)}
                  className={cn('rounded-xl p-3 text-left transition-colors flex items-center justify-between gap-2 border',
                    d.hasHeartRateService
                      ? 'bg-primary/10 border-primary/30 hover:bg-primary/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10')}>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate">{d.name}</p>
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest truncate">
                      {d.hasHeartRateService ? '❤ Monitor cardíaco' : d.bonded ? '🔗 Pareado no aparelho' : `ID ${d.id.slice(-8)}`}
                    </p>
                  </div>
                  {typeof d.rssi === 'number' && (
                    <span className="text-[8px] font-black text-white/30 shrink-0">{d.rssi} dBm</span>
                  )}
                </button>
              ))}
              {isScanning && visibleDevices.length === 0 && (
                <p className="text-white/30 text-[10px] font-black uppercase text-center py-4">Procurando dispositivos próximos...</p>
              )}
            </div>
            {(hiddenCount > 0 || showAllDevices) && (
              <button onClick={() => setShowAllDevices(!showAllDevices)}
                className="text-white/30 text-[9px] font-black uppercase tracking-widest hover:text-white/50 transition-colors">
                {showAllDevices ? 'Mostrar só monitores de FC' : `Mostrar todos (${devices.length})`}
              </button>
            )}
          </div>
        );
      })()}

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
              : 'Use o app instalado, Chrome ou Edge para conectar'}
          </p>
        </motion.div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Dica específica de Garmin quando a leitura de FC falha */}
      {error && (devices.some((d) => isGarminName(d.name)) || isGarminName(connectedDevice?.name) || isGarminName(lastDevice?.name)) && (
        <GarminHint />
      )}

      {/* Reconexão com um toque ao último dispositivo usado (nativo: conecta
          direto pelo ID, sem precisar de novo scan) */}
      {isNative && lastDevice && !isScanning && !isConnecting && (
        <button onClick={() => connect(lastDevice.id)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-primary/10 border border-primary/30 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
          <RefreshCw className="w-4 h-4" />
          <span className="truncate">Reconectar a {lastDevice.name}</span>
        </button>
      )}

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
        <button onClick={() => scan()} disabled={!isSupported}
          className={cn('flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
            isSupported
              ? 'bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(202,253,0,0.2)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10')}>
          <Bluetooth className="w-4 h-4" />
          {devices.length > 0 ? 'Buscar Novamente' : 'Buscar Dispositivos'}
        </button>
      )}

      {/* Web: o chooser padrão filtra por monitores de FC — fallback para tudo */}
      {!isNative && isSupported && !isScanning && !isConnecting && (
        <button onClick={() => scan({ showAll: true })}
          className="text-white/30 text-[9px] font-black uppercase tracking-widest hover:text-white/50 transition-colors">
          Não achou? Mostrar todos os dispositivos
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
  const { samples, reset, startedAt } = useHeartRateSession(bpm, isActive);
  useKeepScreenAwake(isActive); // não deixa a tela dormir durante a leitura
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
    return <HeartRateSummary samples={samples} deviceName={appName} bio={bio} startedAt={startedAt} enableDeviceMetrics persist userId={userId} source="health" onClose={closeSummary} />;
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
          <p className="text-primary/70 text-[9px] font-black uppercase tracking-wider text-center leading-relaxed mt-1">
            Antes de iniciar, ligue um treino no relógio ({platform === 'ios' ? 'app Treino' : 'Samsung Health / app do relógio'}) para gravar a FC em tempo real.
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
