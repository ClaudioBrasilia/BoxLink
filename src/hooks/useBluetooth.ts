import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult, BleDevice } from '@capacitor-community/bluetooth-le';

// ============================================================================
// UUIDs - padrão e proprietários conhecidos
// ============================================================================
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const CYCLING_CADENCE_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
const RUNNING_SPEED_SERVICE = '00001814-0000-1000-8000-00805f9b34fb';
const FITNESS_MACHINE_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';

// Serviços proprietários (fallback de conexão)
const POLAR_PMD_SERVICE = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
const WAHOO_SERVICE = 'a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b';

const OPTIONAL_SERVICES = [
  HEART_RATE_SERVICE,
  BATTERY_SERVICE,
  DEVICE_INFO_SERVICE,
  CYCLING_CADENCE_SERVICE,
  RUNNING_SPEED_SERVICE,
  FITNESS_MACHINE_SERVICE,
  POLAR_PMD_SERVICE,
  WAHOO_SERVICE,
  'battery_service',
  'device_information',
];

// Prefixos de nome conhecidos (relógios, pulseiras, cintas)
const NAME_PREFIXES = [
  // Cintas peitorais
  'Polar', 'H10', 'H9', 'H7', 'OH1', 'Verity',
  'Wahoo', 'TICKR', 'TICKR X',
  'HRM', 'HRM-Dual', 'HRM-Pro', 'HRM-Run', 'HRM-Tri',
  'CooSpo', 'Magene', 'Moofit', 'BerryMed', 'Pulsoid',
  'Decathlon', 'Kalenji', 'Geonaute',
  'Stryd', 'Suunto',
  // Garmin
  'Garmin', 'Forerunner', 'Fenix', 'Venu', 'Vivoactive', 'Vivosmart', 'Vivofit', 'Edge', 'Instinct', 'Epix', 'Enduro',
  // Xiaomi / Amazfit / Huami
  'Mi', 'Mi Band', 'Mi Watch', 'Xiaomi', 'Redmi',
  'Amazfit', 'Bip', 'Stratos', 'GTS', 'GTR', 'T-Rex', 'Verge', 'Cor',
  // Huawei / Honor
  'Huawei', 'Honor', 'Band', 'Watch GT', 'TalkBand',
  // Samsung
  'Galaxy', 'Galaxy Watch', 'Galaxy Fit', 'Gear',
  // Apple
  'Apple Watch',
  // Fitbit
  'Fitbit', 'Charge', 'Versa', 'Sense', 'Inspire', 'Luxe',
  // Genéricos / chineses
  'ZeFit', 'Lefun', 'ID115', 'ID130', 'M4', 'M5', 'M6', 'Y68', 'D13', 'D20',
  'Watch', 'Smart', 'Fit', 'HR', 'BP', 'Pulse', 'Cardio',
];

// ============================================================================
// Tipos
// ============================================================================
export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi?: number;
  hasHeartRateService: boolean;
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

function parseHeartRate(value: DataView): number {
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;
  return is16bit ? value.getUint16(1, true) : value.getUint8(1);
}

function isLikelyHRDevice(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return /watch|band|hr|pulse|cardio|fit|polar|garmin|wahoo|tickr|amazfit|fitbit|mi |huawei|honor|galaxy|forerunner|fenix|venu/i.test(lower);
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
  // SCAN
  // --------------------------------------------------------------------------
  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setStatus('scanning');

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
          // Em alguns Androids requestEnable não está disponível; segue.
        }

        const found = new Map<string, DiscoveredDevice>();

        await BleClient.requestLEScan(
          { allowDuplicates: false }, // sem filtro de serviço — pega tudo
          (result: ScanResult) => {
            const id = result.device.deviceId;
            const name =
              result.device.name ||
              result.localName ||
              `Dispositivo ${id.slice(-5)}`;
            const services = (result.uuids || []).map((u) => u.toLowerCase());
            const hasHR = services.includes(HEART_RATE_SERVICE);

            const existing = found.get(id);
            if (!existing || (result.rssi && (!existing.rssi || result.rssi > existing.rssi))) {
              found.set(id, { id, name, rssi: result.rssi, hasHeartRateService: hasHR });
              const sorted = Array.from(found.values()).sort((a, b) => {
                if (a.hasHeartRateService !== b.hasHeartRateService) return a.hasHeartRateService ? -1 : 1;
                const aLikely = isLikelyHRDevice(a.name);
                const bLikely = isLikelyHRDevice(b.name);
                if (aLikely !== bLikely) return aLikely ? -1 : 1;
                return (b.rssi ?? -999) - (a.rssi ?? -999);
              });
              setDevices(sorted);
            }
          }
        );

        // Para o scan após 15s
        setTimeout(async () => {
          try {
            await BleClient.stopLEScan();
          } catch {}
          setStatus((s) => (s === 'scanning' ? 'disconnected' : s));
        }, 15000);
        return;
      }

      // ---------------- WEB (Chrome desktop / Android) ----------------
      const filters: BluetoothLEScanFilter[] = [
        { services: [HEART_RATE_SERVICE] },
        { services: [CYCLING_CADENCE_SERVICE] },
        { services: [RUNNING_SPEED_SERVICE] },
        { services: [FITNESS_MACHINE_SERVICE] },
        ...NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
      ];

      let device: BluetoothDevice;
      try {
        device = await navigator.bluetooth.requestDevice({
          filters,
          optionalServices: OPTIONAL_SERVICES,
        });
      } catch (err: any) {
        if (err?.name === 'NotFoundError') {
          // Retry mostrando todos os dispositivos
          device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: OPTIONAL_SERVICES,
          });
        } else {
          throw err;
        }
      }

      const discovered: DiscoveredDevice = {
        id: device.id,
        name: device.name || `Dispositivo ${device.id.slice(-5)}`,
        hasHeartRateService: true, // assume — só descobre ao conectar
      };
      webDeviceRef.current = device;
      setDevices([discovered]);
      setStatus('disconnected');
    } catch (err: any) {
      console.error('[BLE] scan erro', err);
      const msg = err?.message || 'Erro ao escanear dispositivos';
      if (err?.name !== 'NotFoundError') setError(msg);
      setStatus(err?.name === 'NotFoundError' ? 'disconnected' : 'error');
    }
  }, [isNative, isIOSWeb]);

  const stopScan = useCallback(async () => {
    if (isNative) {
      try {
        await BleClient.stopLEScan();
      } catch {}
    }
    setStatus((s) => (s === 'scanning' ? 'disconnected' : s));
  }, [isNative]);

  // --------------------------------------------------------------------------
  // CONNECT
  // --------------------------------------------------------------------------
  const connect = useCallback(
    async (deviceId: string) => {
      setError(null);
      setStatus('connecting');

      try {
        // ---------------- NATIVO ----------------
        if (isNative) {
          try {
            await BleClient.stopLEScan();
          } catch {}

          await BleClient.connect(deviceId, () => {
            console.log('[BLE] desconectado');
            setStatus('disconnected');
            setConnectedDevice(null);
            setHeartRate(null);
            nativeDeviceIdRef.current = null;
          });

          nativeDeviceIdRef.current = deviceId;

          // Tenta HR service padrão; se falhar tenta proprietários
          const servicesToTry = [HEART_RATE_SERVICE, POLAR_PMD_SERVICE, WAHOO_SERVICE];
          let subscribed = false;

          for (const svc of servicesToTry) {
            try {
              await BleClient.startNotifications(
                deviceId,
                svc,
                HEART_RATE_MEASUREMENT,
                (value) => {
                  const bpm = parseHeartRate(value);
                  if (bpm > 0 && bpm < 250) setHeartRate(bpm);
                }
              );
              subscribed = true;
              break;
            } catch (e) {
              console.warn(`[BLE] HR não disponível em ${svc}`, e);
            }
          }

          if (!subscribed) {
            throw new Error(
              'Dispositivo conectado mas não expõe Heart Rate. Verifique se está no modo "transmissão" ou use outro app.'
            );
          }

          const dev = devices.find((d) => d.id === deviceId) || {
            id: deviceId,
            name: `Dispositivo ${deviceId.slice(-5)}`,
            hasHeartRateService: true,
          };
          setConnectedDevice(dev);
          setStatus('connected');
          return;
        }

        // ---------------- WEB ----------------
        const device = webDeviceRef.current;
        if (!device) throw new Error('Nenhum dispositivo selecionado.');

        device.addEventListener('gattserverdisconnected', () => {
          setStatus('disconnected');
          setConnectedDevice(null);
          setHeartRate(null);
          webCharRef.current = null;
        });

        const server = await device.gatt!.connect();

        const servicesToTry = [HEART_RATE_SERVICE, POLAR_PMD_SERVICE, WAHOO_SERVICE];
        let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

        for (const svc of servicesToTry) {
          try {
            const service = await server.getPrimaryService(svc);
            characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
            break;
          } catch {
            // tenta próximo
          }
        }

        if (!characteristic) {
          throw new Error(
            'Dispositivo conectado mas não expõe Heart Rate. Tente outro dispositivo ou ative o modo de transmissão.'
          );
        }

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', (e: any) => {
          const value: DataView = e.target.value;
          const bpm = parseHeartRate(value);
          if (bpm > 0 && bpm < 250) setHeartRate(bpm);
        });
        webCharRef.current = characteristic;

        setConnectedDevice({
          id: device.id,
          name: device.name || `Dispositivo ${device.id.slice(-5)}`,
          hasHeartRateService: true,
        });
        setStatus('connected');
      } catch (err: any) {
        console.error('[BLE] connect erro', err);
        setError(err?.message || 'Erro ao conectar');
        setStatus('error');
      }
    },
    [isNative, devices]
  );

  // --------------------------------------------------------------------------
  // DISCONNECT
  // --------------------------------------------------------------------------
  const disconnect = useCallback(async () => {
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
    if (isNative || isIOSWeb || typeof navigator === 'undefined' || !('bluetooth' in navigator)) return;
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
