import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Register Service Worker for offline support & automatic caching
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available, updating in background...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] Application is fully cached and ready to work offline!');
  },
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker successfully registered:', swUrl);
    if (registration) {
      // Check for SW updates periodically (every 1 hour)
      setInterval(() => {
        registration.update().catch(err => console.debug('[PWA] Update check suppressed:', err));
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.warn('[PWA] Service Worker registration failed:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
