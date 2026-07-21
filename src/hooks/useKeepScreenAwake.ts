// src/hooks/useKeepScreenAwake.ts
// ============================================================================
// Mantém a tela ligada enquanto `active` for true (ex.: durante a leitura de FC),
// evitando que o celular durma e derrube a conexão / pare de transmitir à TV.
//
// Estratégia por plataforma:
//   • App NATIVO (Capacitor) → @capacitor-community/keep-awake, que usa a flag
//     oficial do SO (FLAG_KEEP_SCREEN_ON no Android). GARANTIDO — não depende do
//     navegador nem da economia de bateria do fabricante.
//   • WEB → NoSleep.js: Wake Lock API onde existe (Chrome/Android, Safari 16.4+)
//     e fallback de vídeo mudo em loop no iPhone/Bluefy (religado no gesto).
//
// ⚠️ O plugin nativo é carregado por IMPORT DINÂMICO — nunca é avaliado no build
//    web puro (Vercel/Netlify).
// ============================================================================
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import NoSleep from 'nosleep.js';

export function useKeepScreenAwake(active: boolean): void {
  const noSleepRef = useRef<NoSleep | null>(null);

  useEffect(() => {
    if (!active) return;

    // ── App nativo: flag oficial do SO (mais confiável que a web) ──────────
    if (Capacitor.isNativePlatform()) {
      let cancelled = false;
      import('@capacitor-community/keep-awake')
        .then(({ KeepAwake }) => {
          if (!cancelled) return KeepAwake.keepAwake();
        })
        .catch((e) => console.warn('[keep-awake] falhou', e));
      return () => {
        cancelled = true;
        import('@capacitor-community/keep-awake')
          .then(({ KeepAwake }) => KeepAwake.allowSleep())
          .catch(() => {});
      };
    }

    // ── Web: NoSleep (Wake Lock + fallback de vídeo no iOS) ────────────────
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;

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
