import { Capacitor } from '@capacitor/core';

/**
 * Ciclo de vida do service worker — a origem dos dois bugs de "nada funciona".
 *
 * As rotas são carregadas sob demanda (chunks com hash no nome). Quando sai um
 * deploy novo, o hash muda e os arquivos antigos somem do servidor. Se a casca
 * do app que está rodando veio do cache do service worker (a versão anterior),
 * cada `import()` de rota pede um arquivo que não existe mais e falha com
 * "Failed to fetch dynamically imported module" — a tela de erro na web e os
 * botões do menu que não levam a lugar nenhum.
 *
 * No APK é pior: o WebView guarda o service worker entre atualizações do app,
 * então a primeira abertura depois de instalar uma versão nova sobe a casca
 * velha em cima de um bundle novo. E ali o service worker não serve para nada:
 * os arquivos já estão dentro do APK. Por isso, no nativo, ele é removido.
 */

const CLEANUP_FLAG = 'boxlink:sw-cleanup';
const RECOVERY_FLAG = 'boxlink:bundle-recovery';

/**
 * Falha de `import()` de rota quase nunca é "sem internet": é o arquivo com
 * hash antigo que não existe mais depois de um deploy (ou de uma atualização
 * do APK). Cada navegador descreve isso de um jeito, daí a lista.
 */
export function isBundleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|module script failed|ChunkLoadError|Loading chunk|error loading dynamically imported module|Unable to preload/i.test(
    message,
  );
}

function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function flagged(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    // Modo privado / storage bloqueado: sem memória, melhor não recarregar.
    return true;
  }
}

function flag(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Sem storage não dá para evitar loop de reload — quem chama já checou.
  }
}

function unflag(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignorado de propósito.
  }
}

/** Apaga service workers e caches — tudo que pode estar servindo bundle velho. */
export async function clearCachedShell(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Nada a fazer: seguimos para os caches.
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Ignorado: o reload ainda pode resolver.
  }
}

/**
 * Recarrega a página, mas só depois que o documento atual terminou de carregar:
 * o Chrome engasga com um reload disparado no meio do carregamento — a página
 * nova chega e os scripts dela nunca executam, o que deixaria o app em branco
 * justamente na hora de se recuperar.
 */
async function reloadWhenDocumentSettles(): Promise<void> {
  if (document.readyState !== 'complete') {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      window.addEventListener('load', done, { once: true });
      // Sem refém do evento: se algum recurso pendurar, recarrega assim mesmo.
      window.setTimeout(done, 3000);
    });
  }
  window.location.reload();
}

/**
 * Última linha de defesa quando um chunk de rota não carrega: limpa o que
 * estiver em cache e recarrega uma única vez por sessão. Se mesmo assim
 * falhar, o erro sobe para a ErrorBoundary em vez de virar loop de reload.
 */
export async function recoverFromStaleBundle(): Promise<void> {
  if (flagged(RECOVERY_FLAG)) return;
  flag(RECOVERY_FLAG);
  await clearCachedShell();
  await reloadWhenDocumentSettles();
}

/**
 * O app subiu inteiro. Libera só o reload de troca de service worker na web —
 * a recuperação de bundle continua marcada até o fim da sessão, senão um chunk
 * que realmente sumiu do servidor viraria um ciclo infinito de reloads. No
 * nativo a marca também fica: se o unregister não pegar, liberar aqui faria o
 * app se recarregar a cada abertura.
 */
export function markBundleHealthy(): void {
  if (isNativeApp()) return;
  unflag(CLEANUP_FLAG);
}

async function disableServiceWorkerOnNative(): Promise<void> {
  const hadController = Boolean(navigator.serviceWorker?.controller);
  await clearCachedShell();
  // Enquanto houver controlador, a página atual ainda é a casca velha —
  // um reload (no máximo um por sessão) traz a versão que veio no APK.
  if (hadController && !flagged(CLEANUP_FLAG)) {
    flag(CLEANUP_FLAG);
    await reloadWhenDocumentSettles();
  }
}

function registerServiceWorkerOnWeb(): void {
  // Se a página já era controlada por um service worker e outro assume, o
  // bundle em memória ficou órfão: recarrega antes que um import() falhe.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || flagged(CLEANUP_FLAG)) return;
    flag(CLEANUP_FLAG);
    void reloadWhenDocumentSettles();
  });

  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // Sem service worker o app continua funcionando — só perde o offline.
  });
}

export function setupServiceWorker(): void {
  if (typeof window === 'undefined') return;

  // O Vite avisa quando um modulepreload não resolve — mesmo sintoma do chunk
  // que sumiu, e é o aviso mais cedo que existe dele. O erro segue seu curso
  // de propósito: cancelá-lo faria o import() resolver com módulo vazio, e a
  // tela de erro passaria a falar de "undefined" em vez do bundle velho.
  window.addEventListener('vite:preloadError', () => {
    void recoverFromStaleBundle();
  });

  if (!('serviceWorker' in navigator)) return;

  if (isNativeApp()) {
    void disableServiceWorkerOnNative();
    return;
  }

  // Em dev o sw.js nem existe; registrar só no build serve para não deixar
  // um service worker de produção grudado no localhost do desenvolvedor.
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', registerServiceWorkerOnWeb, { once: true });
}
