// src/hooks/useBluetooth.ts
// ============================================================================
// Conexão DIRETA de Frequência Cardíaca via Bluetooth LE (baixa latência).
// Funciona em:
//   • Android/iOS nativo (Capacitor) → @capacitor-community/bluetooth-le
//   • Chrome/Edge desktop e Android → Web Bluetooth API
// Suporta UUIDs padrão + proprietários (Huawei/Xiaomi/genéricos) via catálogo
// central em src/lib/heartRate.ts, com service discovery dinâmico.
//
// Robustez de conexão:
//   • Pré-checagens antes do scan (Bluetooth ligado, Localização no Android).
//   • Retry automático da conexão GATT (falhas transitórias / status 133).
//   • Timeout que CANCELA a conexão pendente (evita conexão "fantasma").
//   • Probe: só considera conectado quando uma characteristic entrega FC real.
//   • Auto-reconexão silenciosa em queda de sinal, sem encerrar a sessão.
//   • Último dispositivo persistido para reconexão com um toque.
// ----------------------------------------------------------------------------
// ⚠️ O plugin nativo é carregado por IMPORT DINÂMICO — nunca é avaliado no
//    build/execução web puro, evitando quebrar Vercel/Netlify.
// ============================================================================
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import type { ScanResult } from '@capacitor-community/bluetooth-le';
import { upsertLiveHeartRate, clearLiveHeartRate } from '../lib/liveHeartRate';
import {
  HEART_RATE_SERVICE,
  HEART_RATE_MEASUREMENT,
  POLAR_PMD_SERVICE,
  WAHOO_SERVICE,
  GENERIC_SERVICES,
  OPTIONAL_SERVICES,
  NAME_PREFIXES,
  parseHeartRateFallback,
  parseStandardHeartRate,
  hasNoSensorContact,
  normalizeUuid,
  isSameUuid,
  isLikelyHRDeviceName,
  isLikelyHRService,
  isLikelyHRCharacteristic,
} from '../lib/heartRate';
import { calculateHrvMetrics, parseStandardHeartRateMeasurement } from '../lib/hrv';
import { validateBleHrvCapture, type HrvQualityReport, type HrvPlatform } from '../lib/hrvValidation';
import { APP_NAME } from '../lib/appMode';

// ─── Carregador dinâmico do plugin nativo (só executa em plataforma nativa) ──
type BleClientType = typeof import('@capacitor-community/bluetooth-le').BleClient;
let _bleClientPromise: Promise<BleClientType> | null = null;
async function getBleClient(): Promise<BleClientType> {
  if (!_bleClientPromise) {
    _bleClientPromise = import('@capacitor-community/bluetooth-le').then((m) => m.BleClient);
  }
  return _bleClientPromise;
}

// ============================================================================
// Constantes de conexão
// ============================================================================
const SCAN_DURATION_MS = 15000;
const GATT_CONNECT_TIMEOUT_MS = 12000;
// Conexões BLE no Android falham à 1ª tentativa com frequência (status 133);
// tentar de novo resolve na maioria dos casos.
const CONNECT_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 800;
// Probe: tempo máximo aguardando a 1ª leitura de FC em cada characteristic.
// A characteristic PADRÃO (0x2A37) ganha janela maior: um relógio pode levar
// alguns segundos para começar a transmitir após conectar, e não queremos
// desistir dela cedo e latchar numa characteristic proprietária que devolve
// bytes aleatórios (parse tolerante) — origem de leituras de FC "malucas".
const PROBE_STANDARD_MS = 12000;
const PROBE_KNOWN_MS = 6000;
const PROBE_GENERIC_MS = 4000;
const PROBE_TOTAL_BUDGET_MS = 20000;
// Auto-reconexão em queda de sinal.
const RECONNECT_DELAYS_MS = [1000, 2000, 4000];
// Watchdog de leitura travada: monitores de FC (Garmin, cintas, etc.) enviam
// ~1 leitura/seg. Se o GATT continua "conectado" mas as notificações param de
// chegar (comum no modo "Transmitir FC" do Garmin — a transmissão pausa sem
// derrubar o link), o último valor fica CONGELADO na tela. Passado este tempo
// sem nova leitura, tratamos como sinal perdido: limpamos o número travado e
// re-armamos a inscrição (reconexão) para retomar o fluxo.
const HR_STALE_TIMEOUT_MS = 10000;
const HR_STALE_CHECK_MS = 2000;

const LAST_DEVICE_KEY = 'boxlink:lastBleDevice';

// ============================================================================
// Tipos
// ============================================================================
export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi?: number;
  hasHeartRateService: boolean;
  /** Provável monitor de FC (serviço conhecido OU nome típico) — usado no filtro da lista. */
  likelyHR: boolean;
  /** Já pareado no sistema (Android) — aparece na lista antes mesmo do scan. */
  bonded?: boolean;
  serviceUUIDs?: string[];
}

export interface LastDevice {
  id: string;
  name: string;
}

export type BleDiagnosticLevel = 'info' | 'success' | 'warning' | 'error';

export interface BleDiagnostic {
  at: string;
  code: string;
  message: string;
  level: BleDiagnosticLevel;
  detail?: string;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'error';

interface UseBluetoothReturn {
  isSupported: boolean;
  isNative: boolean;
  isIOSWeb: boolean;
  status: ConnectionStatus;
  error: string | null;
  devices: DiscoveredDevice[];
  connectedDevice: DiscoveredDevice | null;
  lastDevice: LastDevice | null;
  heartRate: number | null;
  /** Intervalos RR em ms recebidos no canal padrão, acumulados na conexão. */
  rrIntervalsMs: number[];
  /** Relatório de qualidade da HRV da conexão atual. */
  hrvQuality: HrvQualityReport;
  scan: (opts?: { showAll?: boolean }) => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  diagnostics: BleDiagnostic[];
}

// ============================================================================
// Helpers
// ============================================================================
function detectIOSWeb(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  return isIOS && !Capacitor.isNativePlatform();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadLastDevice(): LastDevice | null {
  try {
    const raw = localStorage.getItem(LAST_DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveLastDevice(device: LastDevice): void {
  try {
    localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(device));
  } catch {
    /* storage indisponível */
  }
}

/**
 * Marcas que SEMPRE transmitem FC pelo canal padrão 0x2A37 — nunca por uma
 * characteristic proprietária. Para elas, restringimos o probe ao canal padrão:
 * evita "latchar" num canal proprietário faladeiro (ex.: Garmin no iPhone/Bluefy),
 * que o parser tolerante transformaria numa FREQUÊNCIA FALSA.
 */
function isStandardOnlyBrand(name?: string | null): boolean {
  if (!name) return false;
  return /garmin|forerunner|f[eé]nix|fenix|venu|vivoactive|vivosmart|instinct|epix|enduro|marq|descent|\bpolar\b|wahoo|tickr|coospo|magene|suunto|scosche|decathlon|kalenji|geonaute/i.test(
    name
  );
}

/** Converte erros técnicos do plugin/navegador em mensagens acionáveis. */
function friendlyBleError(err: unknown): string {
  const msg = String((err as any)?.message || err || '');
  if (/permission|denied|not granted|autoriz/i.test(msg)) {
    return `Permissão de Bluetooth negada. Vá em Configurações → Apps → ${APP_NAME} → Permissões e permita "Dispositivos por perto" (ou Bluetooth).`;
  }
  if (/bluetooth.*(off|disabled|unavailable)|adapter/i.test(msg)) {
    return 'O Bluetooth está desligado. Ative o Bluetooth do aparelho e tente novamente.';
  }
  return msg || 'Erro de Bluetooth';
}

/** Prováveis monitores de FC primeiro; depois nomeados; por fim sinal mais forte. */
function sortDevices(list: DiscoveredDevice[]): DiscoveredDevice[] {
  return [...list].sort((a, b) => {
    if (a.hasHeartRateService !== b.hasHeartRateService) return a.hasHeartRateService ? -1 : 1;
    if (a.likelyHR !== b.likelyHR) return a.likelyHR ? -1 : 1;
    const aHasName = a.name && !a.name.startsWith('Desconhecido');
    const bHasName = b.name && !b.name.startsWith('Desconhecido');
    if (aHasName !== bHasName) return aHasName ? -1 : 1;
    return (b.rssi ?? -999) - (a.rssi ?? -999);
  });
}

/** Candidato de assinatura descoberto no device (serviço + characteristic). */
interface ProbeCandidate {
  service: string;
  characteristic: string;
  /** UUID conhecido de FC → merece espera maior no probe. */
  known: boolean;
  /** 0x2A37 padrão: qualquer notificação já confirma que é o canal de FC. */
  standard: boolean;
}

// ============================================================================
// Hook
// ============================================================================
export function useBluetooth(userId?: string): UseBluetoothReturn {
  const isNative = Capacitor.isNativePlatform();
  const isIOSWeb = detectIOSWeb();
  // O Safari/Chrome/Edge do iPhone NÃO expõem navigator.bluetooth (Apple bloqueia
  // no WebKit). Porém navegadores como o Bluefy implementam Web Bluetooth via
  // CoreBluetooth — nesse caso navigator.bluetooth existe mesmo no iOS e devemos
  // permitir. Por isso a base do suporte é a presença REAL de navigator.bluetooth.
  const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const isSupported = isNative || hasWebBluetooth;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [rrIntervalsMs, setRrIntervalsMs] = useState<number[]>([]);
  const [rrQualityStats, setRrQualityStats] = useState({
    totalIntervals: 0,
    invalidIntervals: 0,
    lastPacketAt: null as number | null,
    rrAdvertised: false,
    rrPayloadTruncated: false,
  });
  const [lastDevice, setLastDevice] = useState<LastDevice | null>(loadLastDevice);
  const [diagnostics, setDiagnostics] = useState<BleDiagnostic[]>([]);
  const diagnosticsRef = useRef<BleDiagnostic[]>([]);

  const webDeviceRef = useRef<BluetoothDevice | null>(null);
  const webCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const nativeDeviceIdRef = useRef<string | null>(null);
  const activeSubRef = useRef<{ service: string; characteristic: string } | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBpmRef = useRef<number | null>(null);
  // Instante (epoch ms) da última leitura de FC recebida — base do watchdog de
  // leitura travada. null = nenhuma leitura fresca no momento.
  const lastBpmAtRef = useRef<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Espelho síncrono do status (callbacks de desconexão chegam fora do React).
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const updateStatus = useCallback((s: ConnectionStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const recordDiagnostic = useCallback((code: string, message: string, level: BleDiagnosticLevel = 'info', detail?: string) => {
    const item: BleDiagnostic = { at: new Date().toISOString(), code, message, level, detail };
    diagnosticsRef.current = [...diagnosticsRef.current, item].slice(-40);
    setDiagnostics(diagnosticsRef.current);
  }, []);

  const clearDiagnostics = useCallback(() => {
    diagnosticsRef.current = [];
    setDiagnostics([]);
  }, []);

  // true enquanto a desconexão foi pedida pelo usuário (não deve reconectar).
  const intentionalDisconnectRef = useRef(false);
  // Geração da sessão de conexão: bump cancela loops de retry/reconexão antigos.
  const sessionGenRef = useRef(0);
  // Localização desligada no Android (necessária p/ scan em Android ≤ 11).
  const locationOffRef = useRef(false);

  const rememberDevice = useCallback((device: LastDevice) => {
    saveLastDevice(device);
    setLastDevice(device);
  }, []);

  // --------------------------------------------------------------------------
  // Broadcast do BPM para o Supabase (TV ao vivo). Throttle de 5s.
  // --------------------------------------------------------------------------
  const removeFromSupabase = useCallback(() => {
    if (!userId) return;
    clearLiveHeartRate(userId).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (status !== 'connected') return;
    syncTimerRef.current = setInterval(() => {
      const bpm = lastBpmRef.current;
      if (!bpm) return;
      // Não retransmite um valor travado para a TV: só envia leituras frescas.
      const at = lastBpmAtRef.current;
      if (at == null || Date.now() - at > HR_STALE_TIMEOUT_MS) return;
      upsertLiveHeartRate(userId, bpm, connectedDevice?.name ?? 'Bluetooth').catch(() => {});
    }, 5000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    };
  }, [userId, status, connectedDevice]);

  const pushHeartRate = useCallback((bpm: number, rr: number[] = []) => {
    lastBpmRef.current = bpm;
    lastBpmAtRef.current = Date.now();
    setHeartRate(bpm);
    if (rr.length > 0) setRrIntervalsMs((prev) => [...prev, ...rr]);
  }, []);

  const recordBleHrvMeasurement = useCallback((measurement: ReturnType<typeof parseStandardHeartRateMeasurement>) => {
    setRrQualityStats((prev) => ({
      totalIntervals: prev.totalIntervals + measurement.rrTotal,
      invalidIntervals: prev.invalidIntervals + measurement.rrInvalid,
      lastPacketAt: Date.now(),
      rrAdvertised: prev.rrAdvertised || measurement.rrPresent,
      rrPayloadTruncated: prev.rrPayloadTruncated || measurement.rrPayloadTruncated,
    }));
  }, []);

  const hrvQuality = useMemo<HrvQualityReport>(() => {
    const platform = Capacitor.getPlatform();
    const normalizedPlatform: HrvPlatform = platform === 'ios' || platform === 'android' ? platform : 'web';
    const metrics = calculateHrvMetrics(rrIntervalsMs);
    return validateBleHrvCapture({
      rrIntervalsMs,
      totalIntervals: rrQualityStats.totalIntervals,
      invalidIntervals: rrQualityStats.invalidIntervals,
      rrAdvertised: rrQualityStats.rrAdvertised,
      rrPayloadTruncated: rrQualityStats.rrPayloadTruncated,
      lastPacketAt: rrQualityStats.lastPacketAt,
      sourceName: connectedDevice?.name ?? lastDevice?.name,
      sourceId: connectedDevice?.id ?? lastDevice?.id,
      deviceId: connectedDevice?.id ?? lastDevice?.id,
      platform: normalizedPlatform,
      metric: 'rmssd',
      valueMs: metrics.rmssdMs,
    });
  }, [connectedDevice, lastDevice, rrIntervalsMs, rrQualityStats]);

  const resetToDisconnected = useCallback(() => {
    updateStatus('disconnected');
    setConnectedDevice(null);
    setHeartRate(null);
    // RR e seu relatório permanecem disponíveis para o resumo da sessão.
    // A próxima chamada de connect() inicia um acumulador novo.
    lastBpmRef.current = null;
    lastBpmAtRef.current = null;
    nativeDeviceIdRef.current = null;
    activeSubRef.current = null;
    webCharRef.current = null;
    removeFromSupabase();
  }, [removeFromSupabase, updateStatus]);

  // --------------------------------------------------------------------------
  // Inicialização (nativo)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isNative) return;
    getBleClient()
      .then((Ble) => Ble.initialize({ androidNeverForLocation: true }))
      .catch((e) => console.warn('[BLE] initialize falhou', e));
  }, [isNative]);

  // --------------------------------------------------------------------------
  // Pré-checagens do ambiente nativo (Bluetooth ligado, Localização no Android)
  // --------------------------------------------------------------------------
  const ensureNativeReady = useCallback(async (Ble: BleClientType) => {
    await Ble.initialize({ androidNeverForLocation: true });

    let enabled = true;
    try {
      enabled = await Ble.isEnabled();
    } catch {
      /* se a checagem falhar, deixa o scan reportar o erro real */
    }
    if (!enabled) {
      try {
        await Ble.requestEnable(); // Android: diálogo do sistema; iOS: indisponível
        enabled = await Ble.isEnabled();
      } catch {
        /* noop */
      }
    }
    if (!enabled) {
      throw new Error('O Bluetooth está desligado. Ative o Bluetooth do aparelho e busque novamente.');
    }

    // Android ≤ 11 exige o serviço de Localização LIGADO para o scan retornar
    // resultados. Não bloqueia o scan (no 12+ não é necessário), mas guarda o
    // estado para explicar um scan vazio.
    locationOffRef.current = false;
    if (Capacitor.getPlatform() === 'android') {
      try {
        locationOffRef.current = !(await Ble.isLocationEnabled());
      } catch {
        /* noop */
      }
    }
  }, []);

  const stopScan = useCallback(async () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (isNative) {
      try {
        const Ble = await getBleClient();
        await Ble.stopLEScan();
      } catch {
        /* noop */
      }
    }
    if (statusRef.current === 'scanning') updateStatus('disconnected');
  }, [isNative, updateStatus]);

  // --------------------------------------------------------------------------
  // Ordena serviços/characteristics e monta a lista de candidatos ao probe.
  // --------------------------------------------------------------------------
  const buildCandidates = useCallback(
    (
      services: { uuid: string; characteristics: { uuid: string; notifiable: boolean }[] }[],
      deviceName?: string | null
    ): ProbeCandidate[] => {
      const sortedServices = [...services].sort((a, b) => {
        const aHR = isSameUuid(a.uuid, HEART_RATE_SERVICE);
        const bHR = isSameUuid(b.uuid, HEART_RATE_SERVICE);
        if (aHR !== bHR) return aHR ? -1 : 1;
        const aLikely = isLikelyHRService(a.uuid);
        const bLikely = isLikelyHRService(b.uuid);
        if (aLikely !== bLikely) return aLikely ? -1 : 1;
        return 0;
      });

      const standardOnly = isStandardOnlyBrand(deviceName);

      const candidates: ProbeCandidate[] = [];
      for (const service of sortedServices) {
        // Navegadores-ponte (ex.: Bluefy no iOS, que expõe Web Bluetooth sobre
        // CoreBluetooth) às vezes reportam `properties` incompletas e o 0x2A37
        // chega sem a flag de notify — some do probe e o relógio nunca é lido.
        // Só para marcas padrão-only o canal PADRÃO entra mesmo sem a flag: se
        // realmente não for notificável, startNotifications() rejeita e o erro
        // é registrado. Em aparelhos genéricos manter o filtro estrito importa —
        // eles dependem dos canais proprietários e um 0x2A37 mudo consumiria o
        // orçamento do probe antes de chegar no canal que funciona.
        const notifiable = service.characteristics.filter(
          (c) => c.notifiable || (standardOnly && isSameUuid(c.uuid, HEART_RATE_MEASUREMENT))
        );
        const prioritized = [...notifiable].sort((a, b) => {
          const aKnown = isLikelyHRCharacteristic(a.uuid);
          const bKnown = isLikelyHRCharacteristic(b.uuid);
          if (aKnown !== bKnown) return aKnown ? -1 : 1;
          return 0;
        });
        for (const char of prioritized) {
          // `service`/`characteristic` guardam o UUID COMO A PLATAFORMA ENTREGOU:
          // é essa string que volta para startNotifications() e para o mapa de
          // characteristics. Só as COMPARAÇÕES são normalizadas.
          candidates.push({
            service: service.uuid,
            characteristic: char.uuid,
            known: isLikelyHRCharacteristic(char.uuid) || isSameUuid(service.uuid, HEART_RATE_SERVICE),
            standard: isSameUuid(char.uuid, HEART_RATE_MEASUREMENT),
          });
        }
      }

      // A characteristic PADRÃO (0x2A37) é a fonte autoritativa: probamos ela
      // SEMPRE PRIMEIRO, com janela longa (PROBE_STANDARD_MS) e parser estrito.
      // Isso evita latchar num canal proprietário "faladeiro" — que o parse
      // tolerante transformaria em BPM aleatório (bug do Garmin).
      // MAS os demais canais permanecem como FALLBACK: muitos relógios Samsung
      // e genéricos ANUNCIAM o 0x180D porém só entregam a FC de fato por uma
      // characteristic proprietária. Restringir só ao padrão os deixava sem
      // conectar. Ordena: padrão(ões) primeiro, resto depois (ordem preservada).
      const standard = candidates.filter((c) => c.standard);
      const rest = candidates.filter((c) => !c.standard);

      // Marca padrão-only (Garmin/Polar/Wahoo/etc.): usa SÓ o canal padrão,
      // MESMO QUE ele não tenha aparecido. Sondar os canais proprietários desses
      // relógios não só desperdiça todo o orçamento do probe (o GFDI da Garmin,
      // 6A4E…, é protocolo do Garmin Connect e nunca carrega FC) como é PERIGOSO:
      // o parser tolerante varre o buffer atrás de um byte "plausível" e pode
      // exibir uma FREQUÊNCIA FALSA a partir de bytes de protocolo.
      if (standardOnly && standard.length === 0) {
        const hasHrService = services.some((s) => isSameUuid(s.uuid, HEART_RATE_SERVICE));
        recordDiagnostic(
          'standard_channel_missing',
          hasHrService
            ? 'O serviço de FC (0x180D) existe, mas o relógio não expôs o canal padrão 0x2A37 — sinal de que a transmissão de FC não está ativa.'
            : 'O relógio não expôs o serviço de FC (0x180D) — sinal de que a transmissão de FC não está ativa.',
          'warning',
          services.map((s) => s.uuid).join(', ') || undefined
        );
      }

      const result = standardOnly ? standard : [...standard, ...rest];

      recordDiagnostic(
        'probe_plan',
        result.length > 0
          ? `${result.length} canal(is) serão testados para receber FC.`
          : 'Nenhum canal de FC compatível foi encontrado neste dispositivo.',
        result.length > 0 ? 'info' : 'warning',
        result.map((c) => `${c.characteristic}${c.standard ? ' (padrão 0x2A37)' : ''}`).join(', ') || undefined
      );

      return result;
    },
    [recordDiagnostic]
  );

  // Parser por candidato: no canal PADRÃO (0x2A37) usa SEMPRE o parser estrito
  // (respeita flags/formato) — nunca o tolerante, que poderia inventar um BPM a
  // partir de bytes de RR-interval/energia. Só canais não padronizados usam o
  // fallback heurístico.
  const parseCandidateBpm = useCallback(
    (value: DataView, cand: ProbeCandidate): number | null =>
      cand.standard ? parseStandardHeartRate(value) : parseHeartRateFallback(value),
    []
  );

  const noHeartRateError = (deviceName?: string | null) => {
    const name = deviceName || '';
    const message = /garmin|forerunner|fenix|venu|vivoactive|vivosmart|instinct|epix|enduro/i.test(name)
      ? 'Garmin conectado, mas sem FC. No relógio, ative “Transmitir FC”/“Broadcast Heart Rate”, inicie uma atividade e feche o Garmin Connect antes de tentar novamente.'
      : /polar|tickr|wahoo|h10|h9|verity/i.test(name)
        ? 'Sensor conectado, mas sem FC. Vista e umedeça a cinta, feche Polar Flow/Beat ou outro app que esteja usando o sensor e, no H10, habilite duas conexões BLE se precisar mantê-lo conectado a outro aparelho.'
        : /galaxy|samsung|gear|sm-r/i.test(name)
          ? 'Samsung conectado, mas sem FC. Inicie um treino no relógio e verifique se ele está transmitindo por BLE; caso contrário, use Samsung Health/Health Connect ou um app transmissor no relógio.'
          : 'Dispositivo conectado, mas nenhuma leitura de FC chegou. Ative a transmissão de FC ou inicie um treino no dispositivo e tente novamente.';
    const err = new Error(message);
    err.name = 'NoHeartRateError';
    return err;
  };

  // Callback de desconexão inesperada (definido via ref para evitar closures velhas).
  const handleUnexpectedDisconnectRef = useRef<(deviceId: string) => void>(() => {});

  // --------------------------------------------------------------------------
  // CONNECT — NATIVO
  // establishNative: 1 tentativa de GATT connect (com timeout que CANCELA a
  // conexão pendente) + service discovery + probe das characteristics até uma
  // entregar FC de verdade.
  // --------------------------------------------------------------------------
  const establishNative = useCallback(
    async (deviceId: string, deviceName?: string | null): Promise<void> => {
      const Ble = await getBleClient();
      const gen = sessionGenRef.current;

      await new Promise<void>((resolve, reject) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          // Sem isso, o connect segue em background e o device fica "ocupado"
          // (conecta sozinho depois e a próxima tentativa falha).
          Ble.disconnect(deviceId).catch(() => {});
          reject(new Error('Timeout ao conectar. O dispositivo pode estar fora de alcance.'));
        }, GATT_CONNECT_TIMEOUT_MS);

        Ble.connect(deviceId, () => handleUnexpectedDisconnectRef.current(deviceId))
          .then(() => {
            clearTimeout(timer);
            if (!timedOut) resolve();
          })
          .catch((e) => {
            clearTimeout(timer);
            if (!timedOut) reject(e);
          });
      });

      recordDiagnostic('gatt_connected', `Conectado ao GATT de ${deviceName || deviceId}.`, 'success');
      const services = await Ble.getServices(deviceId);
      recordDiagnostic('services_discovered', `${services.length} serviço(s) BLE descoberto(s).`, 'info', services.map((s) => s.uuid).join(', '));
      console.log('[BLE] Serviços descobertos:', services.map((s) => s.uuid));

      const candidates = buildCandidates(
        services.map((s) => ({
          uuid: s.uuid,
          characteristics: (s.characteristics || []).map((c) => ({
            uuid: c.uuid,
            notifiable: !!(c.properties?.notify || c.properties?.indicate),
          })),
        })),
        deviceName
      );

      const probeStart = Date.now();
      for (const cand of candidates) {
        if (sessionGenRef.current !== gen) throw new Error('Operação cancelada.');
        if (Date.now() - probeStart > PROBE_TOTAL_BUDGET_MS) break;

        const waitMs = cand.standard ? PROBE_STANDARD_MS : cand.known ? PROBE_KNOWN_MS : PROBE_GENERIC_MS;
        const ok = await new Promise<boolean>((resolve) => {
          let settled = false;
          let noContactLogged = false;
          const finish = (v: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(v);
          };
          // Timeout = assinatura aceita, mas NENHUM pacote chegou. Diferente de
          // uma falha de startNotifications (abaixo) — registramos separado.
          const timer = setTimeout(() => {
            recordDiagnostic(
              'notification_timeout',
              `Nenhum pacote chegou por ${cand.characteristic} em ${Math.round(waitMs / 1000)}s.`,
              'warning',
              cand.service
            );
            finish(false);
          }, waitMs);
          recordDiagnostic('notification_subscribe', `Tentando receber notificações de ${cand.characteristic}.`, 'info', cand.service);
          Ble.startNotifications(deviceId, cand.service, cand.characteristic, (value) => {
            const standardMeasurement = cand.standard ? parseStandardHeartRateMeasurement(value) : null;
            if (standardMeasurement) recordBleHrvMeasurement(standardMeasurement);
            const bpm = standardMeasurement?.bpm ?? parseCandidateBpm(value, cand);
          const rrIntervalsMs = standardMeasurement?.rrIntervalsMs ?? [];
            // 0x2A37 padrão: qualquer notificação confirma o canal de FC
            // (cinta sem contato com a pele manda 0 bpm até "pegar").
            // Sensor sem contato (flags do 0x2A37): sinal de vida — reseta
            // watchdog sem exibir/latchar um BPM falso.
            if (cand.standard && hasNoSensorContact(value)) {
              lastBpmAtRef.current = Date.now();
              // Registra uma única vez por inscrição: a notificação se repete ~1x/s.
              if (!noContactLogged) {
                noContactLogged = true;
                recordDiagnostic(
                  'sensor_no_contact',
                  'O dispositivo está transmitindo, mas sem contato com a pele. Ajuste-o no pulso (ou umedeça a cinta) para a leitura começar.',
                  'warning',
                  `${cand.service}/${cand.characteristic}`
                );
              }
            } else if (bpm !== null) {
              pushHeartRate(bpm, rrIntervalsMs);
              recordDiagnostic('heart_rate_received', `Leitura válida recebida: ${bpm} BPM.`, 'success', `${cand.service}/${cand.characteristic}`);
            }
            if (bpm !== null || cand.standard) finish(true);
          }).catch((e: any) => {
            // Assinatura RECUSADA pelo dispositivo/plataforma — causa distinta
            // de "assinou mas não chegou pacote".
            recordDiagnostic(
              'notification_error',
              `Não foi possível assinar ${cand.characteristic}.`,
              'error',
              String(e?.message || e)
            );
            finish(false);
          });
        });

        if (ok) {
          console.log(`[BLE] ✅ HR ativo em ${cand.service} / ${cand.characteristic}`);
          nativeDeviceIdRef.current = deviceId;
          activeSubRef.current = { service: cand.service, characteristic: cand.characteristic };
          return;
        }
        try {
          await Ble.stopNotifications(deviceId, cand.service, cand.characteristic);
        } catch {
          /* noop */
        }
        console.warn(`[BLE] Sem leitura de FC em ${cand.service}/${cand.characteristic}`);
      }

      try {
        await Ble.disconnect(deviceId);
      } catch {
        /* noop */
      }
      const noReadingError = noHeartRateError(deviceName);
      recordDiagnostic('no_heart_rate', noReadingError.message, 'warning', deviceName || deviceId);
      throw noReadingError;
    },
    [buildCandidates, parseCandidateBpm, pushHeartRate, recordDiagnostic]
  );

  const connectNative = useCallback(
    async (deviceId: string): Promise<void> => {
      const Ble = await getBleClient();
      await ensureNativeReady(Ble); // Bluetooth ligado? (importante p/ "Reconectar" sem scan)
      try {
        await Ble.stopLEScan();
      } catch {
        /* noop */
      }
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }

      intentionalDisconnectRef.current = false;
      const gen = ++sessionGenRef.current;

      const knownName =
        devices.find((d) => d.id === deviceId)?.name ??
        (lastDevice?.id === deviceId ? lastDevice.name : undefined);

      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
        if (sessionGenRef.current !== gen) throw new Error('Operação cancelada.');
        try {
          await establishNative(deviceId, knownName);
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
          try {
            await Ble.disconnect(deviceId);
          } catch {
            /* noop */
          }
          // Falta de leitura de FC é determinística — retry não ajuda.
          if (e?.name === 'NoHeartRateError') break;
          if (attempt < CONNECT_ATTEMPTS) {
            console.warn(`[BLE] Tentativa ${attempt} falhou, tentando de novo...`, e);
            await sleep(RETRY_BASE_DELAY_MS * attempt);
          }
        }
      }
      if (lastErr) throw lastErr;

      const dev =
        devices.find((d) => d.id === deviceId) || {
          id: deviceId,
          name: lastDevice?.id === deviceId ? lastDevice.name : `Dispositivo ${deviceId.slice(-5)}`,
          hasHeartRateService: true,
          likelyHR: true,
        };
      setConnectedDevice(dev);
      rememberDevice({ id: dev.id, name: dev.name });
      updateStatus('connected');
    },
    [devices, ensureNativeReady, establishNative, lastDevice, rememberDevice, updateStatus]
  );

  // --------------------------------------------------------------------------
  // CONNECT — WEB (mesma estratégia de probe do nativo)
  // --------------------------------------------------------------------------
  const establishWeb = useCallback(
    async (device: BluetoothDevice): Promise<void> => {
      const gen = sessionGenRef.current;
      const server = await device.gatt!.connect();
      recordDiagnostic('gatt_connected', `Conectado ao GATT de ${device.name || 'dispositivo'}.`, 'success');

      let services: BluetoothRemoteGATTService[];
      try {
        services = await server.getPrimaryServices();
      } catch {
        services = [];
        for (const svcUUID of [HEART_RATE_SERVICE, POLAR_PMD_SERVICE, WAHOO_SERVICE, ...GENERIC_SERVICES]) {
          try {
            services.push(await server.getPrimaryService(svcUUID));
          } catch {
            /* serviço ausente */
          }
        }
      }

      // Descobre as characteristics de cada serviço para montar os candidatos.
      const withChars: { uuid: string; chars: Map<string, BluetoothRemoteGATTCharacteristic> }[] = [];
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          withChars.push({
            uuid: service.uuid,
            chars: new Map(chars.map((c) => [normalizeUuid(c.uuid), c])),
          });
        } catch {
          /* serviço sem characteristics acessíveis */
        }
      }

      recordDiagnostic('services_discovered', `${withChars.length} serviço(s) BLE acessível(is).`, 'info', withChars.map((s) => s.uuid).join(', '));

      const candidates = buildCandidates(
        withChars.map((s) => ({
          uuid: s.uuid,
          characteristics: Array.from(s.chars.values()).map((c) => ({
            uuid: c.uuid,
            notifiable: !!(c.properties.notify || c.properties.indicate),
          })),
        })),
        device.name
      );

      const probeStart = Date.now();
      for (const cand of candidates) {
        if (sessionGenRef.current !== gen) throw new Error('Operação cancelada.');
        if (Date.now() - probeStart > PROBE_TOTAL_BUDGET_MS) break;

        const svc = withChars.find((s) => isSameUuid(s.uuid, cand.service));
        const char = svc?.chars.get(normalizeUuid(cand.characteristic));
        if (!char) continue;

        const waitMs = cand.standard ? PROBE_STANDARD_MS : cand.known ? PROBE_KNOWN_MS : PROBE_GENERIC_MS;

        // O listener do probe é o mesmo que fica ativo após a conexão — em caso
        // de sucesso ele permanece registrado; em falha é removido.
        let noContactLogged = false;
        const listener = (e: any) => {
          const value: DataView = e.target.value;
          const standardMeasurement = cand.standard ? parseStandardHeartRateMeasurement(value) : null;
          if (standardMeasurement) recordBleHrvMeasurement(standardMeasurement);
          const bpm = standardMeasurement?.bpm ?? parseCandidateBpm(value, cand);
          const rrIntervalsMs = standardMeasurement?.rrIntervalsMs ?? [];
          // Sensor sem contato (flags do 0x2A37): sinal de vida — reseta
          // watchdog sem exibir/latchar um BPM falso.
          if (cand.standard && hasNoSensorContact(value)) {
            lastBpmAtRef.current = Date.now();
            // Registra uma única vez por inscrição: a notificação se repete ~1x/s.
            if (!noContactLogged) {
              noContactLogged = true;
              recordDiagnostic(
                'sensor_no_contact',
                'O dispositivo está transmitindo, mas sem contato com a pele. Ajuste-o no pulso (ou umedeça a cinta) para a leitura começar.',
                'warning',
                `${cand.service}/${cand.characteristic}`
              );
            }
          } else if (bpm !== null) {
            pushHeartRate(bpm, rrIntervalsMs);
            recordDiagnostic('heart_rate_received', `Leitura válida recebida: ${bpm} BPM.`, 'success', `${cand.service}/${cand.characteristic}`);
          }
        };

        recordDiagnostic('notification_subscribe', `Tentando receber notificações de ${cand.characteristic}.`, 'info', cand.service);
        const ok = await new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (v: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (!v) char.removeEventListener('characteristicvaluechanged', probeListener);
            resolve(v);
          };
          const probeListener = (e: any) => {
            listener(e);
            const value: DataView = e.target.value;
            const standardMeasurement = cand.standard ? parseStandardHeartRateMeasurement(value) : null;
          const bpm = standardMeasurement?.bpm ?? parseCandidateBpm(value, cand);
          const rrIntervalsMs = standardMeasurement?.rrIntervalsMs ?? [];
            if (bpm !== null || cand.standard) finish(true);
          };
          // Timeout = assinatura aceita, mas NENHUM pacote chegou. Diferente de
          // uma falha de startNotifications (abaixo) — registramos separado.
          const timer = setTimeout(() => {
            recordDiagnostic(
              'notification_timeout',
              `Nenhum pacote chegou por ${cand.characteristic} em ${Math.round(waitMs / 1000)}s.`,
              'warning',
              cand.service
            );
            finish(false);
          }, waitMs);
          char.addEventListener('characteristicvaluechanged', probeListener);
          char.startNotifications().catch((e: any) => {
            // Assinatura RECUSADA pelo dispositivo/plataforma — causa distinta
            // de "assinou mas não chegou pacote".
            recordDiagnostic(
              'notification_error',
              `Não foi possível assinar ${cand.characteristic}.`,
              'error',
              String(e?.message || e)
            );
            finish(false);
          });
        });

        if (ok) {
          webCharRef.current = char;
          return;
        }
        try {
          await char.stopNotifications();
        } catch {
          /* noop */
        }
      }

      try {
        device.gatt?.disconnect();
      } catch {
        /* noop */
      }
      const noReadingError = noHeartRateError(device.name);
      recordDiagnostic('no_heart_rate', noReadingError.message, 'warning', device.name || 'dispositivo');
      throw noReadingError;
    },
    [buildCandidates, parseCandidateBpm, pushHeartRate, recordDiagnostic]
  );

  const connectWeb = useCallback(async (): Promise<void> => {
    const device = webDeviceRef.current;
    if (!device) throw new Error('Nenhum dispositivo selecionado.');

    intentionalDisconnectRef.current = false;
    const gen = ++sessionGenRef.current;

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      if (sessionGenRef.current !== gen) throw new Error('Operação cancelada.');
      try {
        await establishWeb(device);
        lastErr = null;
        break;
      } catch (e: any) {
        lastErr = e;
        try {
          device.gatt?.disconnect();
        } catch {
          /* noop */
        }
        if (e?.name === 'NoHeartRateError') break;
        if (attempt < CONNECT_ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
    if (lastErr) throw lastErr;

    // Listener {once:true} — re-registrado a cada conexão bem-sucedida para
    // não acumular handlers duplicados no mesmo device.
    device.addEventListener(
      'gattserverdisconnected',
      () => handleUnexpectedDisconnectRef.current(device.id),
      { once: true }
    );

    const dev = {
      id: device.id,
      name: device.name || `Dispositivo ${device.id.slice(-5)}`,
      hasHeartRateService: true,
      likelyHR: true,
    };
    setConnectedDevice(dev);
    rememberDevice({ id: dev.id, name: dev.name });
    updateStatus('connected');
  }, [establishWeb, rememberDevice, updateStatus]);

  // --------------------------------------------------------------------------
  // AUTO-RECONEXÃO em queda de sinal (não encerra a sessão de treino).
  // --------------------------------------------------------------------------
  const autoReconnect = useCallback(
    async (deviceId: string) => {
      const gen = ++sessionGenRef.current;
      updateStatus('reconnecting');
      setHeartRate(null);

      for (let i = 0; i < RECONNECT_DELAYS_MS.length; i++) {
        await sleep(RECONNECT_DELAYS_MS[i]);
        if (sessionGenRef.current !== gen || intentionalDisconnectRef.current) return;
        try {
          if (isNative) {
            await establishNative(deviceId);
          } else {
            const device = webDeviceRef.current;
            if (!device) break;
            await establishWeb(device);
            device.addEventListener(
              'gattserverdisconnected',
              () => handleUnexpectedDisconnectRef.current(device.id),
              { once: true }
            );
          }
          if (sessionGenRef.current !== gen || intentionalDisconnectRef.current) {
            // usuário desistiu enquanto reconectava — desfaz a conexão
            try {
              if (isNative) (await getBleClient()).disconnect(deviceId).catch(() => {});
              else webDeviceRef.current?.gatt?.disconnect();
            } catch {
              /* noop */
            }
            return;
          }
          console.log(`[BLE] 🔄 Reconectado após queda (tentativa ${i + 1})`);
          updateStatus('connected');
          return;
        } catch (e) {
          console.warn(`[BLE] Reconexão ${i + 1}/${RECONNECT_DELAYS_MS.length} falhou`, e);
        }
      }

      if (sessionGenRef.current === gen) resetToDisconnected();
    },
    [isNative, establishNative, establishWeb, resetToDisconnected, updateStatus]
  );

  useEffect(() => {
    handleUnexpectedDisconnectRef.current = (deviceId: string) => {
      console.log('[BLE] desconectado', deviceId);
      activeSubRef.current = null;
      nativeDeviceIdRef.current = null;
      webCharRef.current = null;
      if (intentionalDisconnectRef.current) {
        resetToDisconnected();
        return;
      }
      // Queda durante conexão/probe: quem trata é o próprio fluxo de connect.
      if (statusRef.current !== 'connected') return;
      void autoReconnect(deviceId);
    };
  }, [autoReconnect, resetToDisconnected]);

  // --------------------------------------------------------------------------
  // WATCHDOG de leitura travada.
  // O GATT pode continuar "conectado" enquanto as notificações de FC param
  // (Garmin no modo "Transmitir FC" pausa a transmissão sem derrubar o link).
  // Sem isto, o último BPM fica congelado na tela — 150 no app enquanto o
  // relógio já marca 95. Ao detectar silêncio prolongado, limpamos o número
  // travado e re-armamos a inscrição via reconexão (retoma o fluxo de leituras).
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (status !== 'connected') return;
    const id = setInterval(() => {
      const at = lastBpmAtRef.current;
      if (at == null) return; // ainda aguardando a 1ª leitura — não é "travado"
      if (Date.now() - at <= HR_STALE_TIMEOUT_MS) return;

      console.warn('[BLE] FC travada (sem novas leituras) — reconectando para retomar');
      // Zera o valor congelado: a UI volta a "aguardando leitura" e o broadcast
      // para a TV para de reenviar o número velho.
      setHeartRate(null);
      lastBpmRef.current = null;
      lastBpmAtRef.current = null;

      const deviceId = nativeDeviceIdRef.current ?? webDeviceRef.current?.id;
      if (!deviceId) return;

      // Marca 'reconnecting' ANTES de derrubar o link: o callback de desconexão
      // ignora quedas fora do estado 'connected', evitando reconexão dupla.
      updateStatus('reconnecting');
      // Força uma desconexão limpa — no caso travado o GATT ainda está de pé, e
      // reconectar por cima às vezes não re-arma as notificações. Uma reconexão
      // do zero recria a inscrição e retoma o fluxo de leituras.
      if (isNative) {
        getBleClient().then((Ble) => Ble.disconnect(deviceId)).catch(() => {});
      } else {
        try {
          webDeviceRef.current?.gatt?.disconnect();
        } catch {
          /* noop */
        }
      }
      void autoReconnect(deviceId);
    }, HR_STALE_CHECK_MS);
    return () => clearInterval(id);
  }, [status, isNative, autoReconnect, updateStatus]);

  // --------------------------------------------------------------------------
  // CONNECT — dispatcher
  // --------------------------------------------------------------------------
  const connect = useCallback(
    async (deviceId: string) => {
      setError(null);
      setRrIntervalsMs([]);
      setRrQualityStats({
        totalIntervals: 0,
        invalidIntervals: 0,
        lastPacketAt: null,
        rrAdvertised: false,
        rrPayloadTruncated: false,
      });
      recordDiagnostic('connect_start', 'Iniciando conexão com o dispositivo selecionado.', 'info', deviceId);
      updateStatus('connecting');
      try {
        if (isNative) await connectNative(deviceId);
        else await connectWeb();
      } catch (err: any) {
        console.error('[BLE] connect erro', err);
        const message = err?.name === 'AbortError' ? 'Operação cancelada.' : friendlyBleError(err);
        recordDiagnostic('connection_error', message, 'error', err?.message || String(err));
        setError(message);
        updateStatus('error');
      }
    },
    [isNative, connectNative, connectWeb, recordDiagnostic, updateStatus]
  );

  // --------------------------------------------------------------------------
  // SCAN
  //   Nativo → dispositivos pareados no Android aparecem NA HORA + scan LE 15s.
  //   Web    → chooser do navegador filtrado por FC (showAll exibe tudo) e
  //            conexão DIRETA ao dispositivo escolhido (sem segundo toque).
  // --------------------------------------------------------------------------
  const scan = useCallback(
    async (opts?: { showAll?: boolean }) => {
      const showAll = !!opts?.showAll;
      clearDiagnostics();
      recordDiagnostic('scan_start', 'Iniciando busca por dispositivos BLE.', 'info', showAll ? 'filtros ampliados' : 'filtro de frequência cardíaca');
      setError(null);
      setDevices([]);
      updateStatus('scanning');

      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }

      try {
        // Só bloqueia iOS-web quando NÃO há Web Bluetooth (Safari/Chrome/Edge do iPhone).
        // Com Bluefy (navigator.bluetooth presente), seguimos normalmente.
        if (isIOSWeb && !hasWebBluetooth) {
          throw new Error(
            `Este navegador do iPhone não suporta Bluetooth Web. Abra o ${APP_NAME} pelo navegador "Bluefy" (grátis na App Store) ou instale o app nativo.`
          );
        }

        // ---------------- NATIVO ----------------
        if (isNative) {
          const Ble = await getBleClient();
          await ensureNativeReady(Ble);

          const found = new Map<string, DiscoveredDevice>();

          // Pareados no sistema (Android) — relógios costumam estar pareados;
          // listá-los de imediato evita esperar o scan de 15s.
          if (Capacitor.getPlatform() === 'android') {
            try {
              const bonded = await Ble.getBondedDevices();
              for (const b of bonded) {
                const name = b.name || '';
                if (!isLikelyHRDeviceName(name)) continue; // ignora fones/carro/etc.
                found.set(b.deviceId, {
                  id: b.deviceId,
                  name,
                  hasHeartRateService: false,
                  likelyHR: true,
                  bonded: true,
                  serviceUUIDs: [],
                });
              }
              if (found.size > 0) setDevices(sortDevices(Array.from(found.values())));
            } catch {
              /* indisponível nesta plataforma */
            }
          }

          await Ble.requestLEScan(
            { allowDuplicates: true }, // essencial: agrega advertising packets rotativos
            (result: ScanResult) => {
              const id = result.device.deviceId;
              const name = result.device.name || result.localName || '';

              const existing = found.get(id);
              const existingUUIDs = new Set(existing?.serviceUUIDs || []);
              (result.uuids || []).forEach((u) => existingUUIDs.add(normalizeUuid(u)));

              const serviceUUIDs = Array.from(existingUUIDs);
              const hasHR =
                serviceUUIDs.some((u) => isLikelyHRService(u)) ||
                existing?.hasHeartRateService ||
                false;
              const displayName = name || existing?.name || `Desconhecido ${id.slice(-5)}`;
              if (!existing) {
                recordDiagnostic('device_found', `Dispositivo encontrado: ${displayName}.`, 'info', serviceUUIDs.join(', ') || 'sem UUID anunciado');
              }
              const likelyHR =
                hasHR || isLikelyHRDeviceName(displayName) || existing?.likelyHR || false;

              if (
                !existing ||
                (result.rssi !== undefined &&
                  (existing.rssi === undefined || result.rssi > existing.rssi))
              ) {
                found.set(id, {
                  id,
                  name: displayName,
                  rssi: result.rssi ?? existing?.rssi,
                  hasHeartRateService: hasHR,
                  likelyHR,
                  bonded: existing?.bonded,
                  serviceUUIDs,
                });
              } else if (serviceUUIDs.length > (existing.serviceUUIDs?.length || 0)) {
                found.set(id, { ...existing, serviceUUIDs, hasHeartRateService: hasHR, likelyHR });
              }

              setDevices(sortDevices(Array.from(found.values())));
            }
          );

          scanTimerRef.current = setTimeout(async () => {
            try {
              await Ble.stopLEScan();
            } catch {
              /* noop */
            }
            if (found.size === 0 && locationOffRef.current) {
              setError(
                'Nenhum dispositivo encontrado. Em Android 11 ou anterior, o scan Bluetooth exige a Localização (GPS) ligada — ative-a nas configurações rápidas e busque novamente.'
              );
            }
            if (statusRef.current === 'scanning') updateStatus('disconnected');
          }, SCAN_DURATION_MS);
          return;
        }

        // ---------------- WEB ----------------
        // Chooser filtrado por padrão (serviço de FC + nomes conhecidos) — bem
        // menos poluído numa academia. showAll exibe tudo como fallback.
        const device = await navigator.bluetooth.requestDevice(
          showAll
            ? { acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES as (string | number)[] }
            : {
                filters: [
                  { services: [HEART_RATE_SERVICE] },
                  ...NAME_PREFIXES.map((p) => ({ namePrefix: p })),
                ],
                optionalServices: OPTIONAL_SERVICES as (string | number)[],
              }
        );

        webDeviceRef.current = device;
        setDevices([
          {
            id: device.id,
            name: device.name || `Dispositivo ${device.id.slice(-5)}`,
            hasHeartRateService: true, // otimista — confirmamos ao conectar
            likelyHR: true,
          },
        ]);

        // O usuário já escolheu no chooser do navegador — conecta direto,
        // sem exigir um segundo toque na lista.
        updateStatus('connecting');
        await connectWeb();
      } catch (err: any) {
        console.error('[BLE] scan erro', err);
        const message = friendlyBleError(err);
        recordDiagnostic('scan_error', message, 'error', err?.message || String(err));
        if (err?.name === 'NotFoundError') {
          // Chooser cancelado ou sem resultados nos filtros.
          if (!isNative && !showAll) {
            setError('Não achou seu dispositivo? Toque em "Mostrar todos os dispositivos".');
          }
          updateStatus('disconnected');
        } else {
          setError(friendlyBleError(err));
          updateStatus('error');
        }
      }
    },
    [clearDiagnostics, isNative, isIOSWeb, hasWebBluetooth, ensureNativeReady, connectWeb, recordDiagnostic, updateStatus]
  );

  // --------------------------------------------------------------------------
  // DISCONNECT (pedido pelo usuário — não dispara auto-reconexão)
  // --------------------------------------------------------------------------
  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    sessionGenRef.current++;

    try {
      if (isNative && nativeDeviceIdRef.current) {
        const Ble = await getBleClient();
        const sub = activeSubRef.current;
        if (sub) {
          try {
            await Ble.stopNotifications(nativeDeviceIdRef.current, sub.service, sub.characteristic);
          } catch {
            /* noop */
          }
        }
        await Ble.disconnect(nativeDeviceIdRef.current);
      } else if (webDeviceRef.current?.gatt?.connected) {
        webDeviceRef.current.gatt.disconnect();
      }
    } catch (e) {
      console.warn('[BLE] disconnect erro', e);
    }

    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    resetToDisconnected();
  }, [isNative, resetToDisconnected]);

  // --------------------------------------------------------------------------
  // Auto-reconexão Web (Chrome 122+)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isNative || !hasWebBluetooth) return;
    const bt: any = navigator.bluetooth;
    if (typeof bt.getDevices !== 'function') return;

    bt.getDevices()
      .then((known: BluetoothDevice[]) => {
        if (known.length > 0 && !webDeviceRef.current) {
          const last = known[0];
          webDeviceRef.current = last;
          setDevices([
            {
              id: last.id,
              name: last.name || `Dispositivo ${last.id.slice(-5)}`,
              hasHeartRateService: true,
              likelyHR: true,
            },
          ]);
        }
      })
      .catch(() => {});
  }, [isNative, hasWebBluetooth]);

  return {
    isSupported,
    isNative,
    isIOSWeb,
    status,
    error,
    devices,
    connectedDevice,
    lastDevice,
    heartRate,
    rrIntervalsMs,
    scan,
    stopScan,
    connect,
    disconnect,
    diagnostics,
    hrvQuality,
  };
}
