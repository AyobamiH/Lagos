import React from 'react';
import './styles.css'; // Tailwind layer directives processed via PostCSS (Tailwind JIT). Optional pre-built generated.css removed.
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { DiagnosticsProvider } from './context/DiagnosticsContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './theme/ThemeProvider';
import { FeatureFlagsProvider } from './context/FeatureFlagsContext';
import { RateLimitProvider } from './context/RateLimitContext';
import { MutationQueueProvider } from './context/MutationQueueContext';
import { I18nProvider } from './i18n';
import { SkipLink } from './components/SkipLink';
import { GlobalRateLimitBanner } from './components/GlobalRateLimitBanner';

// --- Temporary verbose boot diagnostics (can be removed after issue resolved) ---
window.__BOOT_TS = Date.now();
console.log('[boot] main.tsx script tag executed');
window.addEventListener('error', (e) => {
  console.error('[global error]', e?.error || e?.message, e);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled rejection]', e.reason);
});
try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[boot] #root element not found');
  } else {
    // Mark root so we know JS ran even if React fails later
    rootEl.setAttribute('data-boot-js', '1');
  }
} catch (e) {
  console.error('[boot] early exception before React render', e);
}
// ------------------------------------------------------------------------------

try {
  const rootNode = document.getElementById('root') as HTMLElement;
  if (!rootNode) throw new Error('Missing #root at render time');
  console.log('[boot] starting React render');
  createRoot(rootNode).render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          {/* ToastProvider must wrap AuthProvider because AuthProvider calls useToast */}
          <ToastProvider>
            <I18nProvider>
              <AuthProvider>
                <FeatureFlagsProvider>
                  <RateLimitProvider>
                    <DiagnosticsProvider>
                      <RealtimeProvider>
                        <MutationQueueProvider>
                          <GlobalRateLimitBanner />
                          <SkipLink />
                          <App/>
                        </MutationQueueProvider>
                      </RealtimeProvider>
                    </DiagnosticsProvider>
                  </RateLimitProvider>
                </FeatureFlagsProvider>
              </AuthProvider>
            </I18nProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
  window.__BOOT_RENDERED = true;
  console.log('[boot] React render call completed');
} catch (e) {
  console.error('[boot] React render failed', e);
  const rootNode = document.getElementById('root');
  if (rootNode) rootNode.innerHTML = '<pre style="color:red">React failed to mount: '+String((e as any)?.message||e)+'</pre>';
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}
