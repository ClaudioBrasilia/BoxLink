import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

// Global error handling for unhandled promise rejections (like Supabase fetch failures)
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  if (event.reason?.message?.includes('fetch') || event.reason?.message?.includes('NetworkError')) {
    // We can let the ErrorBoundary handle this if we throw it or manage state
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
