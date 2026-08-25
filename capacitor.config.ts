import type { CapacitorConfig } from '@capacitor/cli';

/**
 * O Capacitor sincroniza um projeto nativo por vez. Os comandos cap:sync:box e
 * cap:sync:solo definem VITE_APP_MODE antes do sync, e a CLI reescreve os
 * identificadores nativos a partir desta configuração.
 *
 * O backend continua compartilhado por intenção; o appId é o limite de
 * distribuição que permite instalar e publicar os dois produtos lado a lado.
 */
const isIndividual = process.env.VITE_APP_MODE === 'individual';

const config: CapacitorConfig = {
  appId: isIndividual ? 'com.crosscity.boxleague' : 'com.crosscity.hub',
  appName: isIndividual ? 'BoxLeague' : 'BoxLink',
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
