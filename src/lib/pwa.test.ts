import { describe, expect, it } from 'vitest';
import { isBundleLoadError } from './pwa';

describe('isBundleLoadError', () => {
  it('reconhece a falha de chunk de rota nos navegadores que usamos', () => {
    const mensagens = [
      // Chrome / Android WebView — a do erro relatado no APK e na web
      'Failed to fetch dynamically imported module: https://box-link.vercel.app/assets/Coach-CLZ1hDUD.js',
      // Firefox
      'error loading dynamically imported module',
      // Safari / iOS
      'Importing a module script failed.',
      // Vite, quando o modulepreload não resolve
      'Unable to preload CSS for /assets/Coach-CLZ1hDUD.js',
    ];

    for (const mensagem of mensagens) {
      expect(isBundleLoadError(new Error(mensagem)), mensagem).toBe(true);
    }
  });

  it('não confunde erro de rede ou de aplicação com bundle velho', () => {
    expect(isBundleLoadError(new Error('Failed to fetch'))).toBe(false);
    expect(isBundleLoadError(new Error('Invalid login credentials'))).toBe(false);
    expect(isBundleLoadError(undefined)).toBe(false);
  });
});
