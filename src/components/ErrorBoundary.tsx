import * as React from 'react';
import { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportClientError } from '../lib/observability';
import { clearCachedShell, isBundleLoadError } from '../lib/pwa';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    reportClientError(error, `react.error_boundary:${errorInfo.componentStack?.slice(0, 500) ?? ''}`);
  }

  public render() {
    const { hasError, error } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      // Versão desatualizada vem primeiro: a mensagem dela também contém
      // "fetch" ("Failed to fetch dynamically imported module") e, tratada
      // como falha de rede, mandava o usuário conferir a internet quando o
      // problema era o cache do app.
      const isStaleBundle = isBundleLoadError(error);
      const isFetchError = !isStaleBundle && (
        error?.message.includes('fetch') ||
        error?.message.includes('NetworkError') ||
        error?.message.includes('credentials')
      );

      const title = isStaleBundle
        ? 'Atualize o aplicativo'
        : isFetchError ? 'Erro de Conexão' : 'Algo deu errado';

      const description = isStaleBundle
        ? 'Esta versão do app ficou desatualizada. Toque abaixo para recarregar com a versão mais nova.'
        : isFetchError
          ? 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
          : 'Ocorreu um erro inesperado na aplicação.';

      // Recarregar sozinho não resolve bundle velho: o cache devolveria a
      // mesma casca quebrada. Limpa antes, depois recarrega.
      const retry = () => {
        void clearCachedShell().finally(() => window.location.reload());
      };

      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-error/10 rounded-3xl border border-error/20 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-error" />
          </div>
          
          <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic mb-2">
            {title}
          </h1>

          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed mb-8">
            {description}
          </p>

          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 mb-8 w-full max-w-md overflow-auto">
            <code className="text-[10px] text-error font-mono break-all">
              {error?.message || 'Erro desconhecido'}
            </code>
          </div>

          <button 
            onClick={retry}
            className="flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            <RefreshCw className="w-5 h-5" />
            {isStaleBundle ? 'Recarregar' : 'Tentar Novamente'}
          </button>
        </div>
      );
    }

    return children;
  }
}
