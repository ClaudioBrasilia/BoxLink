import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';

// ============================================================================
// UUIDs — padrão + MUITOS proprietários (incluindo chineses)
// ============================================================================
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const HEART_RATE_CONTROL = '00002a39-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const CYCLING_CADENCE_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
const RUNNING_SPEED_SERVICE = '00001814-0000-1000-8000-00805f9b34fb';
const FITNESS_MACHINE_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';

// Serviços proprietários conhecidos
const POLAR_PMD_SERVICE = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
const POLAR_PMD_DATA = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
const WAHOO_SERVICE = 'a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b';

// Serviços de fabricantes chineses (genéricos)
const CHINESE_GENERIC_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000fef0-0000-1000-8000-00805f9b34fb',
  '0000fef5-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART (muitos JL/Telink)
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  '0783b03e-8535-b5a0-7140-a304d2495cb7', // Goodix/Many
  '00001530-0000-1000-8000-00805f9b34fb', // Realtek
  'f000ffc0-0451-4000-b000-000000000000', // TI CC254x
];

// Serviços que MUITO provavelmente contêm HR (por naming pattern)
const HR_SERVICE_PATTERNS = [
  /180d/i,         // standard HR
  /heart.?rate/i,
  /hr.?monitor/i,
  /pmd/i,          // Polar
  /fff0/i,         // genérico chinês
  /ffe0/i,         // genérico chinês
  /fef5/i,         // genérico chinês
];

// Characteristics que podem conter HR
const HR_CHARACTERISTIC_UUIDS = [
  HEART_RATE_MEASUREMENT,
  '00002a37-0000-1000-8000-00805f9b34fb',
  POLAR_PMD_DATA,
  // Variações comuns em genéricos
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000fff4-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fef6-0000-1000-8000-00805f9b34fb',
];

// Todas as services opcionais para o Web Bluetooth
const OPTIONAL_SERVICES = [
  HEART_RATE_SERVICE,
  BATTERY_SERVICE,
  DEVICE_INFO_SERVICE,
  CYCLING_CADENCE_SERVICE,
  RUNNING_SPEED_SERVICE,
  FITNESS_MACHINE_SERVICE,
  POLAR_PMD_SERVICE,
  WAHOO_SERVICE,
  ...CHINESE_GENERIC_SERVICES,
  'battery_service',
  'device_information',
  'cycling_speed_and_cadence',
  'running_speed_and_cadence',
  'fitness_machine',
];

// Prefixos de nome expandidos
const NAME_PREFIXES = [
  // Cintas peitorais
  'Polar', 'H10', 'H9', 'H7', 'OH1', 'Verity',
  'Wahoo', 'TICKR', 'TICKR X',
  'HRM', 'HRM-Dual', 'HRM-Pro', 'HRM-Run', 'HRM-Tri',
  'CooSpo', 'Magene', 'Moofit', 'BerryMed', 'Pulsoid',
  'Decathlon', 'Kalenji', 'Geonaute', 'Stryd', 'Suunto',
  // Garmin
  'Garmin', 'Forerunner', 'Fenix', 'Venu', 'Vivoactive', 'Vivosmart', 'Vivofit', 'Edge', 'Instinct', 'Epix', 'Enduro',
  // Xiaomi / Amazfit
  'Mi', 'Mi Band', 'Mi Watch', 'Xiaomi', 'Redmi', 'Amazfit', 'Bip', 'Stratos', 'GTS', 'GTR', 'T-Rex', 'Verge', 'Cor',
  // Huawei / Honor
  'Huawei', 'Honor', 'Band', 'Watch GT', 'TalkBand',
  // Samsung
  'Galaxy', 'Galaxy Watch', 'Galaxy Fit', 'Gear',
  // Apple
  'Apple Watch',
  // Fitbit
  'Fitbit', 'Charge', 'Versa', 'Sense', 'Inspire', 'Luxe',
  // Genéricos chineses — expandido
  'Haylou', 'LS01', 'LS02', 'Realme', 'Oppo', 'Lenovo', 'HW01', 'HX03',
  'Zeblaze', 'Diggro', 'ID208', 'ID205', 'IWO', 'DT28', 'DT100', 'DT',
  'ZeFit', 'Lefun', 'ID115', 'ID130', 'M4', 'M5', 'M6', 'Y68', 'D13', 'D20',
  'Watch', 'Smart', 'Fit', 'HR', 'BP', 'Pulse', 'Cardio', 'Band',
  'Health', 'Sport', 'Tracker', 'Bracelet',
];

// ============================================================================
// Tipos
// ============================================================================
export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi?: number;
  hasHeartRateService: boolean;
  serviceUUIDs?: string[];
}

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

interface UseBluetoothReturn {
  isSupported: boolean;
  isNative: boolean;
  isIOSWeb: boolean;
  status: ConnectionStatus;
  error: string | null;
  devices: DiscoveredDevice[];
  connectedDevice: DiscoveredDevice | null;
  heartRate: number | null;
  scan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
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

function parseHeartRate(value: DataView): number | null {
  if (value.byteLength < 2) return null;
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;
  const isSensorContact = (flags & 0x06) !== 0;
  
  let bpm: number;
  if (is16bit) {
    if (value.byteLength < 3) return null;
    bpm = value.getUint16(1, true);
  } else {
    bpm = value.getUint8(1);
  }
  
  // Valida faixa razoável
  if (bpm < 30 || bpm > 250) return null;
  return bpm;
}

/**
 * Tenta interpretar dados brutos como HR de formatos variados.
 * Muitos genéricos enviam o BPM em formatos não padrão.
 */
function parseHeartRateFallback(value: DataView): number | null {
  // Tenta parse padrão primeiro
  const standard = parseHeartRate(value);
  if (standard) return standard;

  // Tenta como uint16 LE sem flags (comum em genéricos)
  if (value.byteLength >= 2) {
    const raw = value.getUint16(0, true);
    if (raw > 30 && raw < 250) return raw;
  }

  // Tenta como uint8 único
  if (value.byteLength >= 1) {
    const raw = value.getUint8(0);
    if (raw > 30 && raw < 250) return raw;
  }

  // Tenta extrair de byte array procurando valor plausível
  for (let i = 0; i < value.byteLength; i++) {
    const val = value.getUint8(i);
    if (val > 40 && val < 220) return val;
  }

  return null;
}

function isLikelyHRDevice(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return /watch|band|hr|pulse|cardio|fit|polar|garmin|wahoo|tickr|amazfit|fitbit|mi |huawei|honor|galaxy|forerunner|fenix|venu|haylou|realme|oppo|lenovo|id\d|ze.?fit|lefun|m[4-6]\b|y68|d13|d20|iwatch|bracelet|tracker/i.test(lower);
}

/**
 * Verifica se uma characteristic UUID "parece" ser de heart rate.
 * Além dos UUIDs conhecidos, verifica padrões comuns em genéricos.
 */
function isLikelyHRCharacteristic(uuid: string): boolean {
  const lower = uuid.toLowerCase();
  for (const known of HR_CHARACTERISTIC_UUIDS) {
    if (lower === known.toLowerCase()) return true;
  }
  // Padrões: fff1, fff4, ffe1 (muito comuns em genéricos)
  if (/fff[1-9a-f]/i.test(lower)) return true;
  if (/ffe[1-9a-f]/i.test(lower)) return true;
  if (/fef[5-9a-f]/i.test(lower)) return true;
  return false;
}

// ============================================================================
// Hook
// ============================================================================
export function useBluetooth(): UseBluetoothReturn {
  const isNative = Capacitor.isNativePlatform();
  const isIOSWeb = detectIOSWeb();
  const isSupported =
    isNative ||
    (typeof navigator !== 'undefined' && 'bluetooth' in navigator && !isIOSWeb);

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);

  const webDeviceRef = useRef<BluetoothDevice | null>(null);
  const webCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const nativeDeviceIdRef = useRef<string | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);

  // --------------------------------------------------------------------------
  // Inicialização
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isNative) {
      BleClient.initialize({ androidNeverForLocation: true }).catch((e) =>
        console.warn('[BLE] initialize falhou', e)
      );
    }
  }, [isNative]);

  // --------------------------------------------------------------------------
  // SCAN — NATIVO (otimizado para genéricos)
  // --------------------------------------------------------------------------
  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setStatus('scanning');

    // Limpa timer anterior
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    try {
      if (isIOSWeb) {
        throw new Error(
          'iOS Safari não suporta Bluetooth Web. Instale o aplicativo nativo para conectar dispositivos.'
        );
      }

      // ---------------- NATIVO (Android via Capacitor) ----------------
      if (isNative) {
        await BleClient.initialize({ androidNeverForLocation: true });
        try {
          await BleClient.requestEnable();
        } catch {
          // requestEnable pode não estar disponível
        }

        const found = new Map<string, DiscoveredDevice>();

        await BleClient.requestLEScan(
          {
            // ⭐ allowDuplicates: true — essencial para pegar todos os advertising packets
            allowDuplicates: true,
          },
          (result: ScanResult) => {
            const id = result.device.deviceId;
            const name =
              result.device.name ||
              result.localName ||
              '';

            // Agrega UUIDs ao longo do tempo (advertising rotativo)
            const existing = found.get(id);
            const existingUUIDs = new Set(existing?.serviceUUIDs || []);
            (result.uuids || []).forEach((u) => existingUUIDs.add(u.toLowerCase()));

            const serviceUUIDs = Array.from(existingUUIDs);
            const hasHR = serviceUUIDs.some(
              (u) =>
                u === HEART_RATE_SERVICE ||
                HR_SERVICE_PATTERNS.some((p) => p.test(u))
            );

            // Só atualiza se RSSI melhor ou é primeira vez
            if (!existing || (result.rssi !== undefined && (existing.rssi === undefined || result.rssi > existing.rssi))) {
              found.set(id, {
                id,
                name: name || `Desconhecido ${id.slice(-5)}`,
                rssi: result.rssi ?? existing?.rssi,
                hasHeartRateService: hasHR || existing?.hasHeartRateService || false,
                serviceUUIDs,
              });
            } else if (serviceUUIDs.length > (existing.serviceUUIDs?.length || 0)) {
              // Atualiza UUIDs mesmo com RSSI pior (mais informação)
              found.set(id, {
                ...existing,
                serviceUUIDs,
                hasHeartRateService: hasHR || existing.hasHeartRateService,
              });
            }

            // Ordenação inteligente
            const sorted = Array.from(found.values()).sort((a, b) => {
              // 1. Tem HR service conhecido
              if (a.hasHeartRateService !== b.hasHeartRateService) return a.hasHeartRateService ? -1 : 1;
              // 2. Nome parece dispositivo HR
              const aLikely = isLikelyHRDevice(a.name);
              const bLikely = isLikelyHRDevice(b.name);
              if (aLikely !== bLikely) return aLikely ? -1 : 1;
              // 3. Tem nome vs sem nome
              const aHasName = a.name && !a.name.startsWith('Desconhecido');
              const bHasName = b.name && !b.name.startsWith('Desconhecido');
              if (aHasName !== bHasName) return aHasName ? -1 : 1;
              // 4. Sinal mais forte
              return (b.rssi ?? -999) - (a.rssi ?? -999);
            });
            setDevices(sorted);
          }
        );

        // Para o scan após 15s
        scanTimerRef.current = setTimeout(async () => {
          try {
            await BleClient.stopLEScan();
          } catch {}
          setStatus((s) => (s === 'scanning' ? 'disconnected' : s));
        }, 15000);
        return;
      }

      // ---------------- WEB ----------------
      // ⭐ Vai direto com acceptAllDevices + optionalServices abrangentes
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: OPTIONAL_SERVICES,
      });

      webDeviceRef.current = device;
      setDevices([
        {
          id: device.id,
          name: device.name || `Dispositivo ${device.id.slice(-5)}`,
          hasHeartRateService: true, // otimista — verificamos ao conectar
        },
      ]);
      setStatus('disconnected');
    } catch (err: any) {
      console.error('[BLE] scan erro', err);
      const msg = err?.message || 'Erro ao escanear dispositivos';
      if (err?.name !== 'NotFoundError') setError(msg);
      setStatus(err?.name === 'NotFoundError' ? 'disconnected' : 'error');
    }
  }, [isNative, isIOSWeb]);

  const stopScan = useCallback(async () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (isNative) {
      try {
        await BleClient.stopLEScan();
      } catch {}
    }
    setStatus((s) => (s === 'scanning' ? 'disconnected' : s));
  }, [isNative]);

  // --------------------------------------------------------------------------
  // CONNECT — NATIVO (com service discovery dinâmico)
  // --------------------------------------------------------------------------
  const connectNative = useCallback(
    async (deviceId: string): Promise<void> => {
      // Para o scan antes de conectar
      try {
        await BleClient.stopLEScan();
      } catch {}

      // Abort controller para timeout
      connectAbortRef.current = new AbortController();
      const { signal } = connectAbortRef.current;

      // Timeout de 12s
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout ao conectar. O dispositivo pode estar fora de alcance.'));
        }, 12000);
        signal.addEventListener('abort', () => clearTimeout(timer));
      });

      const connectPromise = (async () => {
        await BleClient.connect(
          deviceId,
          () => {
            console.log('[BLE] desconectado');
            setStatus('disconnected');
            setConnectedDevice(null);
            setHeartRate(null);
            nativeDeviceIdRef.current = null;
          }
        );

        // ⭐ SERVICE DISCOVERY — varre TUDO que o dispositivo expõe
        const services = await BleClient.getServices(deviceId);

        console.log(
          '[BLE] Serviços descobertos:',
          services.map((s) => s.uuid)
        );

        // Ordena serviços: padrão HR primeiro, depois padrões "suspeitos" de genéricos, depois resto
        const sortedServices = services.sort((a, b) => {
          const aHR = a.uuid.toLowerCase() === HEART_RATE_SERVICE;
          const bHR = b.uuid.toLowerCase() === HEART_RATE_SERVICE;
          if (aHR !== bHR) return aHR ? -1 : 1;

          const aLikely = HR_SERVICE_PATTERNS.some((p) => p.test(a.uuid));
          const bLikely = HR_SERVICE_PATTERNS.some((p) => p.test(b.uuid));
          if (aLikely !== bLikely) return aLikely ? -1 : 1;

          return 0;
        });

        // ⭐ Para cada serviço, descobre características e tenta notificar
        for (const service of sortedServices) {
          try {
            const characteristics = await BleClient.getCharacteristics(
              deviceId,
              service.uuid
            );

            console.log(
              `[BLE] Serviço ${service.uuid}:`,
              characteristics.map((c) => `${c.uuid} (props: ${c.properties?.join(',') || '?'})`)
            );

            // Filtra características que suportam notify ou indicate
            const notifiableChars = characteristics.filter(
              (c) =>
                c.properties &&
                (c.properties.includes('notify') ||
                  c.properties.includes('indicate') ||
                  // Se properties vierem como string (varia por plataforma)
                  (typeof c.properties === 'string' &&
                    (c.properties.includes('notify') || c.properties.includes('indicate'))))
            );

            // Prioriza HR conhecidas, depois tenta todas notificáveis
            const prioritizedChars = notifiableChars.sort((a, b) => {
              const aKnown = isLikelyHRCharacteristic(a.uuid);
              const bKnown = isLikelyHRCharacteristic(b.uuid);
              if (aKnown !== bKnown) return aKnown ? -1 : 1;
              return 0;
            });

            for (const char of prioritizedChars) {
              try {
                console.log(`[BLE] Tentando notificar ${service.uuid} / ${char.uuid}`);
                await BleClient.startNotifications(
                  deviceId,
                  service.uuid,
                  char.uuid,
                  (value) => {
                    const bpm = parseHeartRateFallback(value);
                    if (bpm !== null) {
                      setHeartRate(bpm);
                    }
                  }
                );
                console.log(`[BLE] ✅ HR ativo em ${service.uuid} / ${char.uuid}`);
                // Sucesso! Não precisa tentar mais serviços
                nativeDeviceIdRef.current = deviceId;
                return;
              } catch (e) {
                console.warn(
                  `[BLE] Falha ao notificar ${service.uuid} / ${char.uuid}:`,
                  e
                );
                // Continua tentando outras características
              }
            }
          } catch (e) {
            console.warn(`[BLE] Falha ao acessar serviço ${service.uuid}:`, e);
            // Continua para próximo serviço
          }
        }

        // Se chegou aqui, nenhum serviço funcionou
        throw new Error(
          'Dispositivo conectado mas não foi possível ativar o monitor cardíaco. ' +
          'Verifique se o dispositivo está no modo "transmissão" ou use outro app para parear primeiro.'
        );
      })();

      await Promise.race([connectPromise, timeoutPromise]);

      // Monta device info
      const dev = devices.find((d) => d.id === deviceId) || {
        id: deviceId,
        name: `Dispositivo ${deviceId.slice(-5)}`,
        hasHeartRateService: true,
      };
      setConnectedDevice(dev);
      setStatus('connected');
    },
    [devices]
  );

  // --------------------------------------------------------------------------
  // CONNECT — WEB (com service discovery dinâmico)
  // --------------------------------------------------------------------------
  const connectWeb = useCallback(async (): Promise<void> => {
    const device = webDeviceRef.current;
    if (!device) throw new Error('Nenhum dispositivo selecionado.');

    device.addEventListener('gattserverdisconnected', () => {
      setStatus('disconnected');
      setConnectedDevice(null);
      setHeartRate(null);
      webCharRef.current = null;
    });

    const server = await device.gatt!.connect();

    // ⭐ Descobre TODOS os serviços (não só os 3 fixos)
    let services: BluetoothRemoteGATTService[];
    try {
      services = await server.getServices();
    } catch {
      // Fallback: tenta serviços conhecidos
      services = [];
      for (const svcUUID of [
        HEART_RATE_SERVICE,
        POLAR_PMD_SERVICE,
        WAHOO_SERVICE,
        ...CHINESE_GENERIC_SERVICES,
      ]) {
        try {
          const svc = await server.getPrimaryService(svcUUID);
          services.push(svc);
        } catch {}
      }
    }

    // Ordena: HR padrão primeiro
    services.sort((a, b) => {
      if (a.uuid.toLowerCase() === HEART_RATE_SERVICE) return -1;
      if (b.uuid.toLowerCase() === HEART_RATE_SERVICE) return 1;
      return 0;
    });

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();

        // Filtra notificáveis
        const notifiableChars = characteristics.filter(
          (c) => c.properties.notify || c.properties.indicate
        );

        for (const char of notifiableChars) {
          try {
            console.log(`[BLE Web] Tentando ${service.uuid} / ${char.uuid}`);
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (e: any) => {
              const value: DataView = e.target.value;
              const bpm = parseHeartRateFallback(value);
              if (bpm !== null) setHeartRate(bpm);
            });
            webCharRef.current = char;
            setConnectedDevice({
              id: device.id,
              name: device.name || `Dispositivo ${device.id.slice(-5)}`,
              hasHeartRateService: true,
            });
            setStatus('connected');
            return;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    throw new Error(
      'Dispositivo conectado mas não expõe Heart Rate. Tente outro dispositivo ou ative o modo de transmissão.'
    );
  }, []);

  // --------------------------------------------------------------------------
  // CONNECT — dispatcher
  // --------------------------------------------------------------------------
  const connect = useCallback(
    async (deviceId: string) => {
      setError(null);
      setStatus('connecting');

      try {
        if (isNative) {
          await connectNative(deviceId);
        } else {
          await connectWeb();
        }
      } catch (err: any) {
        console.error('[BLE] connect erro', err);
        if (err?.name === 'AbortError') {
          setError('Operação cancelada.');
        } else {
          setError(err?.message || 'Erro ao conectar');
        }
        setStatus('error');
      }
    },
    [isNative, connectNative, connectWeb]
  );

  // --------------------------------------------------------------------------
  // DISCONNECT
  // --------------------------------------------------------------------------
  const disconnect = useCallback(async () => {
    // Aborta conexão em andamento
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;

    try {
      if (isNative && nativeDeviceIdRef.current) {
        try {
          await BleClient.stopNotifications(
            nativeDeviceIdRef.current,
            HEART_RATE_SERVICE,
            HEART_RATE_MEASUREMENT
          );
        } catch {}
        await BleClient.disconnect(nativeDeviceIdRef.current);
        nativeDeviceIdRef.current = null;
      } else if (webDeviceRef.current?.gatt?.connected) {
        webDeviceRef.current.gatt.disconnect();
      }
    } catch (e) {
      console.warn('[BLE] disconnect erro', e);
    }
    setStatus('disconnected');
    setConnectedDevice(null);
    setHeartRate(null);
  }, [isNative]);

  // --------------------------------------------------------------------------
  // Auto-reconexão Web (Chrome 122+)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isNative || isIOSWeb || typeof navigator === 'undefined' || !('bluetooth' in navigator))
      return;
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
            },
          ]);
        }
      })
      .catch(() => {});
  }, [isNative, isIOSWeb]);

  return {
    isSupported,
    isNative,
    isIOSWeb,
    status,
    error,
    devices,
    connectedDevice,
    heartRate,
    scan,
    stopScan,
    connect,
    disconnect,
  };
}
