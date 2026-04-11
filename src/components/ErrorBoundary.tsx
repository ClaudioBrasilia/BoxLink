import * as React from 'react';
import { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
  }

  public render() {
    const { hasError, error } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      const isFetchError = error?.message.includes('fetch') || 
                           error?.message.includes('NetworkError') ||
                           error?.message.includes('credentials');

      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-error/10 rounded-3xl border border-error/20 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-error" />
          </div>
          
          <h1 className="text-2xl font-headline font-black text-on-surface uppercase italic mb-2">
            {isFetchError ? 'Erro de Conexão' : 'Algo deu errado'}
          </h1>
          
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed mb-8">
            {isFetchError 
              ? 'Não foi possível conectar ao servidor. Verifique sua internet e as configurações do Supabase no menu Settings.'
              : 'Ocorreu um erro inesperado na aplicação.'}
          </p>

          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 mb-8 w-full max-w-md overflow-auto">
            <code className="text-[10px] text-error font-mono break-all">
              {error?.message || 'Erro desconhecido'}
            </code>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-2xl font-headline font-black uppercase italic shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar Novamente
          </button>
        </div>
      );
    }

    return children;
  }
}
