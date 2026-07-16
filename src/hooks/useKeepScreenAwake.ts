// src/hooks/useKeepScreenAwake.ts
// ============================================================================
// Mantém a tela ligada enquanto `active` for true (ex.: durante a leitura de FC),
// evitando que o celular entre em descanso e derrube a conexão Bluetooth.
// Usa a Screen Wake Lock API (Chrome/Android e iOS 16.4+/Bluefy). No app nativo
// (WebView do Capacitor) a mesma API costuma funcionar; se não estiver disponível,
// o hook é um no-op silencioso.
// ============================================================================
import { useEffect, useRef } from 'react';

export function useKeepScreenAwake(active: boolean): void {
  const sentinelRef = useRef<any>(null);

  useEffect(() => {
    const wakeLock: any =
      typeof navigator !== 'undefined' ? (navigator as any).wakeLock : undefined;
    if (!active || !wakeLock?.request) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinelRef.current) return;
      try {
        const sentinel = await wakeLock.request('screen');
        if (cancelled) {
          sentinel.release?.().catch?.(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // O SO libera o lock quando a página fica oculta; limpamos a ref.
        sentinel.addEventListener?.('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        /* permissão negada ou indisponível — segue sem wake lock */
      }
    };

    // Reobtém o lock ao voltar o foco (necessário após a página ficar oculta).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinelRef.current?.release?.().catch?.(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
