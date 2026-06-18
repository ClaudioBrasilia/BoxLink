// src/hooks/useBluetooth.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID, ScanMode } from '@capacitor-community/bluetooth-le';
import { supabase } from '../lib/supabase';

const HEART_RATE_SERVICE = numberToUUID(0x180d);
const HEART_RATE_MEASUREMENT = numberToUUID(0x2a37);
const BATTERY_SERVICE = numberToUUID(0x180f);
const BATTERY_LEVEL = numberToUUID(0x2a19);

// Marcas conhecidas — usadas para destacar (não para filtrar).
const PRIORITY_KEYWORDS = [
  'apple watch', 'galaxy watch', 'galaxy fit', 'fitbit', 'garmin',
  'polar', 'h10', 'oh1', 'verity', 'withings', 'amazfit', 'huawei',
  'mi band', 'xiaomi', 'tickr', 'wahoo', 'coospo', 'magene',
  'scosche', 'rhythm', 'berrymed', 'hrm'
];

const LAST_DEVICE_KEY = 'boxlink:lastDeviceId';

export type BluetoothStatus =
  | 'idle' | 'scanning' | 'connecting' | 'connected' | 'error' | 'unsupported';

export interface BluetoothDevice {
  id: string;
  name: string;
  bpm: number | null;
  battery: number | null;
  rssi: number | null;
  status: 'connected' | 'disconnected';
  lastUpdate: Date | null;
  isPriority?: boolean;
  hasHeartRateService?: boolean;
  _webDevice?: any;
}

interface UseBluetoothReturn {
  devices: BluetoothDevice[];
  status: BluetoothStatus;
  errorMessage: string | null;
  isNative: boolean;
  startScanning: (options?: { showAll?: boolean }) => Promise<void>;
  stopScanning: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  connectWebAcceptAll: () => Promise<void>;
}

export function useBluetooth(userId: string | undefined): UseBluetoothReturn {
  const [, setVersion] = useState(0);
  const [status, setStatus] = useState<BluetoothStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const devicesRef = useRef<Map<string, BluetoothDevice>>(new Map());
  const bumpDevices = useCallback(() => setVersion(v => v + 1), []);

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // HealthKit (carregamento opcional)
  const healthKitRef = useRef<any>(null);
  useEffect(() => {
    if (isNative && platform === 'ios') {
      import('@capgo/capacitor-health')
        .then(mod => { healthKitRef.current = mod.CapacitorHealth ?? mod.default ?? mod; })
        .catch(err => console.warn('[HealthKit] indisponível:', err));
    }
  }, [isNative, platform]);

  const isPriorityDevice = (name: string) =>
    PRIORITY_KEYWORDS.some(k => name.toLowerCase().includes(k));

  // ───── Supabase live sync ────────────────────────────────────────────────
  const syncToSupabase = useCallback(async (deviceId: string, bpm: number, deviceName: string) => {
    if (!userId) return;
    try {
      await supabase.from('heart_rate_live').upsert(
        { user_id: userId, bpm, device_id: deviceId, device_name: deviceName, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    } catch (err) { console.error('[Supabase] sync:', err); }
  }, [userId]);

  const removeFromSupabase = useCallback(async () => {
    if (!userId) return;
    try { await supabase.from('heart_rate_live').delete().eq('user_id', userId); }
    catch (err) { console.error('[Supabase] remove:', err); }
  }, [userId]);

  // ───── Init BLE ──────────────────────────────────────────────────────────
  const initializeBle = useCallback(async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
    } catch (err) {
      console.error('[BLE] init:', err);
      setStatus('unsupported');
      setErrorMessage('Bluetooth indisponível neste aparelho.');
      throw err;
    }
  }, []);

  // ───── Conectar dispositivo ──────────────────────────────────────────────
  const connectDevice = useCallback(async (deviceId: string) => {
    const device = devicesRef.current.get(deviceId);
    if (!device) return;

    setStatus('connecting');
    setErrorMessage(null);

    // Web ─────────────────────────────────────────────
    if (!isNative) {
      try {
        const webDevice = device._webDevice;
        if (!webDevice) throw new Error('Dispositivo Web não encontrado');

        const server = await webDevice.gatt.connect();

        try {
          const bs = await server.getPrimaryService('battery_service');
          const bc = await bs.getCharacteristic('battery_level');
          const bv = await bc.readValue();
          device.battery = bv.getUint8(0);
        } catch { /* sem bateria */ }

        const hrService = await server.getPrimaryService(HEART_RATE_SERVICE);
        const hrChar = await hrService.getCharacteristic(HEART_RATE_MEASUREMENT);

        await hrChar.startNotifications();
        hrChar.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value as DataView;
          const flags = value.getUint8(0);
          const bpm = (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
          if (bpm > 0 && bpm < 250) {
            device.bpm = bpm;
            device.lastUpdate = new Date();
            bumpDevices();
            syncToSupabase(deviceId, bpm, device.name);
          }
        });

        webDevice.addEventListener('gattserverdisconnected', () => {
          device.status = 'disconnected';
          device.bpm = null;
          bumpDevices();
        });

        device.status = 'connected';
        try { localStorage.setItem(LAST_DEVICE_KEY, deviceId); } catch {}
        setStatus('connected');
        bumpDevices();
      } catch (err: any) {
        console.error('[Web] connect:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Erro ao conectar via Web Bluetooth.');
      }
      return;
    }

    // Nativo ──────────────────────────────────────────
    try {
      await BleClient.connect(deviceId, () => {
        device.status = 'disconnected';
        device.bpm = null;
        bumpDevices();
      });
      await BleClient.discoverServices(deviceId);

      try {
        const batt = await BleClient.read(deviceId, BATTERY_SERVICE, BATTERY_LEVEL);
        device.battery = batt.getUint8(0);
      } catch { /* sem bateria */ }

      await BleClient.startNotifications(
        deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT,
        (value) => {
          const flags = value.getUint8(0);
          const bpm = (flags & 0x1) ? value.getUint16(1, true) : value.getUint8(1);
          if (bpm > 0 && bpm < 250) {
            device.bpm = bpm;
            device.lastUpdate = new Date();
            bumpDevices();
            syncToSupabase(deviceId, bpm, device.name);
          }
        }
      );

      device.status = 'connected';
      try { localStorage.setItem(LAST_DEVICE_KEY, deviceId); } catch {}
      setStatus('connected');
      bumpDevices();
    } catch (err: any) {
      console.error('[BLE] connect:', err);
      setStatus('error');
      setErrorMessage(
        platform === 'ios'
          ? 'Não foi possível conectar. Para Apple Watch use HealthKit.'
          : (err?.message || 'Falha ao conectar ao dispositivo.')
      );
    }
  }, [isNative, platform, syncToSupabase, bumpDevices]);

  // ───── Desconectar ───────────────────────────────────────────────────────
  const disconnectDevice = useCallback(async (deviceId: string) => {
    try {
      const device = devicesRef.current.get(deviceId);

      if (!isNative) {
        if (device?._webDevice?.gatt?.connected) device._webDevice.gatt.disconnect();
      } else {
        try { await BleClient.stopNotifications(deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT); } catch {}
        try { await BleClient.disconnect(deviceId); } catch {}
      }

      if (device) {
        device.status = 'disconnected';
        device.bpm = null;
        bumpDevices();
      }
    } catch (err) { console.error('[BLE] disconnect:', err); }
  }, [isNative, bumpDevices]);

  const disconnectAllRef = useRef<() => Promise<void>>(async () => {});
  disconnectAllRef.current = async () => {
    for (const [id] of devicesRef.current) await disconnectDevice(id);
    removeFromSupabase();
    setStatus('idle');
  };

  // ───── Parar scan ────────────────────────────────────────────────────────
  const stopScanning = useCallback(async () => {
    try {
      if (isNative) await BleClient.stopLEScan();
    } catch (err) { console.error('[BLE] stopLEScan:', err); }
    setStatus(prev => (prev === 'scanning' ? 'idle' : prev));
  }, [isNative]);

  // ───── Iniciar scan ──────────────────────────────────────────────────────
  const startScanning = useCallback(async (options?: { showAll?: boolean }) => {
    const showAll = !!options?.showAll;
    setErrorMessage(null);
    setStatus('scanning');

    // Web ─────────────────────────────────────────────
    if (!isNative) {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        setStatus('unsupported');
        setErrorMessage(
          'Seu navegador não suporta Web Bluetooth. Use Chrome/Edge no Android, macOS, Windows ou Linux. No iPhone, instale o app nativo.'
        );
        return;
      }

      try {
        const requestOptions: any = showAll
          ? {
              acceptAllDevices: true,
              optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE, numberToUUID(0x180a)]
            }
          : {
              filters: [
                { services: [HEART_RATE_SERVICE] },
                ...PRIORITY_KEYWORDS.map(k => ({ namePrefix: k[0].toUpperCase() + k.slice(1) }))
              ],
              optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE, numberToUUID(0x180a)]
            };

        const webDevice = await nav.bluetooth.requestDevice(requestOptions);

        const id = webDevice.id;
        const name = webDevice.name || 'Dispositivo Bluetooth';
        const device: BluetoothDevice = {
          id, name,
          bpm: null, battery: null, rssi: null,
          status: 'disconnected', lastUpdate: null,
          isPriority: isPriorityDevice(name),
          hasHeartRateService: !showAll,
          _webDevice: webDevice
        };
        devicesRef.current.set(id, device);
        bumpDevices();
        setStatus('idle');
        // Conecta imediatamente — o picker do navegador já é a "lista"
        await connectDevice(id);
      } catch (err: any) {
        console.error('[Web] scan:', err);
        if (err?.name === 'NotFoundError') {
          setStatus('idle');
          setErrorMessage(showAll
            ? 'Nenhum dispositivo selecionado.'
            : 'Não achou seu monitor? Toque em "Mostrar todos os dispositivos".');
        } else {
          setStatus('error');
          setErrorMessage('Erro ao acessar o Bluetooth do navegador.');
        }
      }
      return;
    }

    // Nativo ──────────────────────────────────────────
    devicesRef.current.clear();
    bumpDevices();

    try {
      await initializeBle();

      const onResult = (result: any) => {
        const id = result.device.deviceId;
        const rawName = result.device.name || result.localName || '';
        const advUuids: string[] = (result.uuids || []).map((u: string) => u.toLowerCase());
        const hasHrService = advUuids.includes(HEART_RATE_SERVICE);
        const name = rawName || (hasHrService ? 'Monitor Cardíaco' : `Dispositivo ${id.slice(-4)}`);

        const existing = devicesRef.current.get(id);
        if (existing) {
          existing.rssi = typeof result.rssi === 'number' ? result.rssi : existing.rssi;
          if (rawName && existing.name !== rawName) existing.name = rawName;
          if (hasHrService) existing.hasHeartRateService = true;
          bumpDevices();
          return;
        }

        const device: BluetoothDevice = {
          id, name,
          bpm: null, battery: null,
          rssi: typeof result.rssi === 'number' ? result.rssi : null,
          status: 'disconnected', lastUpdate: null,
          isPriority: isPriorityDevice(name),
          hasHeartRateService: hasHrService
        };
        devicesRef.current.set(id, device);
        bumpDevices();
      };

      // Filtro no SO quando possível; fallback "showAll" pega tudo
      const scanOptions: any = showAll
        ? { allowDuplicates: true, scanMode: ScanMode.SCAN_MODE_LOW_LATENCY }
        : { services: [HEART_RATE_SERVICE], allowDuplicates: true, scanMode: ScanMode.SCAN_MODE_LOW_LATENCY };

      await BleClient.requestLEScan(scanOptions, onResult);

      // Auto-stop em 20s (ou 45s no modo showAll)
      window.setTimeout(() => { stopScanning(); }, showAll ? 45000 : 20000);
    } catch (err: any) {
      console.error('[BLE] scan:', err);
      setStatus('error');
      const msg = (err?.message || '').toLowerCase();
      if (platform === 'android') {
        if (msg.includes('location') || msg.includes('gps'))
          setErrorMessage('Ative o GPS/Localização do celular (necessário só em Android 11 ou anterior).');
        else if (msg.includes('permission'))
          setErrorMessage('Permita Bluetooth nas configurações do app.');
        else if (msg.includes('disabled') || msg.includes('off'))
          setErrorMessage('Bluetooth desligado. Ative no painel rápido.');
        else
          setErrorMessage('Erro ao escanear. Verifique se Bluetooth está ligado.');
      } else {
        setErrorMessage('Permita acesso ao Bluetooth nas configurações do iPhone.');
      }
    }
  }, [isNative, platform, initializeBle, stopScanning, bumpDevices, connectDevice]);

  // ───── Atalho: Web "aceitar todos" ──────────────────────────────────────
  const connectWebAcceptAll = useCallback(async () => {
    return startScanning({ showAll: true });
  }, [startScanning]);

  // ───── Reconexão automática do último dispositivo (nativo) ──────────────
  useEffect(() => {
    if (!isNative) return;
    const lastId = (() => { try { return localStorage.getItem(LAST_DEVICE_KEY); } catch { return null; } })();
    if (!lastId) return;
    (async () => {
      try {
        await initializeBle();
        const stub: BluetoothDevice = {
          id: lastId, name: 'Último dispositivo',
          bpm: null, battery: null, rssi: null,
          status: 'disconnected', lastUpdate: null
        };
        devicesRef.current.set(lastId, stub);
        await connectDevice(lastId);
      } catch (e) { /* silencioso */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  // ───── Cleanup apenas no unmount real ───────────────────────────────────
  useEffect(() => {
    return () => { void disconnectAllRef.current(); };
  }, []);

  const sorted = Array.from(devicesRef.current.values()).sort((a, b) => {
    if ((b.hasHeartRateService ? 1 : 0) !== (a.hasHeartRateService ? 1 : 0))
      return (b.hasHeartRateService ? 1 : 0) - (a.hasHeartRateService ? 1 : 0);
    if ((b.isPriority ? 1 : 0) !== (a.isPriority ? 1 : 0))
      return (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0);
    return (b.rssi ?? -999) - (a.rssi ?? -999);
  });

  return {
    devices: sorted,
    status,
    errorMessage,
    isNative,
    startScanning,
    stopScanning,
    connectDevice,
    disconnectDevice,
    connectWebAcceptAll
  };
}
