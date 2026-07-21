// src/hooks/useKeepScreenAwake.ts
// ============================================================================
// Mantém a tela ligada enquanto `active` for true (ex.: durante a leitura de FC),
// evitando que o celular durma e derrube a conexão Bluetooth.
//
// Usa a biblioteca NoSleep.js, que combina:
//   • Screen Wake Lock API (Chrome/Android, Safari 16.4+);
//   • Fallback de vídeo mudo em loop para navegadores SEM Wake Lock —
//     ESSENCIAL no iPhone via Bluefy/WKWebView, onde a Wake Lock API não existe.
//
// O fallback de vídeo do iOS só INICIA dentro de um gesto do usuário. Como o
// atleta está tocando na tela ao conectar (buscar/escolher device), religamos o
// NoSleep no próximo toque — assim funciona mesmo no Bluefy.
// ============================================================================
import { useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';

export function useKeepScreenAwake(active: boolean): void {
  const noSleepRef = useRef<NoSleep | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof document === 'undefined') return;

    if (!noSleepRef.current) {
      try {
        noSleepRef.current = new NoSleep();
      } catch {
        return; // ambiente sem DOM/vídeo — nada a fazer
      }
    }
    const ns = noSleepRef.current;
    if (!ns) return;

    // 1) Tentativa imediata — funciona onde há Wake Lock API (Chrome/Android).
    ns.enable().catch(() => {
      /* iOS/Bluefy sem Wake Lock: o vídeo precisa de um gesto — tratado abaixo */
    });

    // 2) Backstop: religa no próximo toque/clique (necessário p/ o vídeo no iOS).
    const onGesture = () => {
      if (!ns.isEnabled) ns.enable().catch(() => {});
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener('touchend', onGesture, opts);
    document.addEventListener('click', onGesture, opts);

    return () => {
      document.removeEventListener('touchend', onGesture, opts);
      document.removeEventListener('click', onGesture, opts);
      try {
        ns.disable();
      } catch {
        /* noop */
      }
    };
  }, [active]);
}
