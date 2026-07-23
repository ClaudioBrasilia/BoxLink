import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crosscity.hub',
  appName: 'BoxLink',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Procurando dispositivos...',
        cancel: 'Cancelar',
        availableDevices: 'Dispositivos disponíveis',
        noDeviceFound: 'Nenhum dispositivo encontrado'
      }
    }
  }
};

export default config;
