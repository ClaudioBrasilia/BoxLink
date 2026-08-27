import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initObservability } from './lib/observability';
import { markBundleHealthy, setupServiceWorker } from './lib/pwa';

initObservability();
// Antes de renderizar: no app nativo o service worker é removido (lá ele só
// serve para servir uma casca velha depois de atualizar o APK) e, na web, é
// registrado com reload automático quando uma versão nova assume.
setupServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

markBundleHealthy();
