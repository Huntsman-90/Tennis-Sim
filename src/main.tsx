import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// 1. Mount React App first to guarantee instant UI rendering
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// 2. Safely register PWA Service Worker in background for offline support
async function initServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const { registerSW } = await import('virtual:pwa-register');
    let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New content available, updating in background...');
        if (typeof updateSW === 'function') {
          updateSW(true).catch(err => console.debug('[PWA] Update error:', err));
        }
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
  } catch (err) {
    console.debug('[PWA] Service Worker initialization note:', err);
  }
}

// Start SW initialization after initial render cycle
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    initServiceWorker();
  } else {
    window.addEventListener('load', initServiceWorker);
  }
}

