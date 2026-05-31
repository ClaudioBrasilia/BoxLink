// src/hooks/useNativeHealth.ts
// Stub temporário para remover dependência do Health Connect.
// O BoxLink passará a utilizar apenas Bluetooth BLE.

export type HealthStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'error'
  | 'unsupported';

interface UseNativeHealthReturn {
  bpm: number | null;
  status: HealthStatus;
  errorMessage: string | null;
  isNative: boolean;
  startReading: () => Promise<void>;
  stopReading: () => void;
}

export function useNativeHealth(): UseNativeHealthReturn {
  const startReading = async (): Promise<void> => {
    console.warn(
      '[NativeHealth] Health Connect temporariamente desabilitado. Use Bluetooth BLE.'
    );
  };

  const stopReading = (): void => {
    console.warn(
      '[NativeHealth] Health Connect temporariamente desabilitado.'
    );
  };

  return {
    bpm: null,
    status: 'unsupported',
    errorMessage:
      'Health Connect temporariamente desabilitado. Utilize Bluetooth BLE.',
    isNative: true,
    startReading,
    stopReading,
  };
}
