import { ComponentType, lazy, LazyExoticComponent } from 'react';
import { isBundleLoadError, recoverFromStaleBundle } from './pwa';

/**
 * `lazy()` que não desiste na primeira falha: tenta de novo (oscilação de rede
 * resolve aqui) e, se ainda assim o arquivo não existir, limpa o cache da casca
 * e recarrega uma vez — é o que devolve o app ao ar em vez de deixar o menu
 * inteiro sem resposta.
 */
export function lazyRoute<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      if (!isBundleLoadError(error)) throw error;

      try {
        return await loader();
      } catch {
        // Confirmado: o chunk não vem. Parte para a recuperação.
      }

      await recoverFromStaleBundle();
      // Se a recuperação já foi usada nesta sessão não há reload, e o erro
      // segue para a ErrorBoundary — que explica o que fazer.
      throw error;
    }
  });
}
