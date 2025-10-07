// Simple client-side RUM collection
// Captures navigation start -> first content (rudimentary) and key actions.
import { API_BASE, lastCorrelationId } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Attempt to read build version from injected global or env replacement
// (You can later wire Vite define: { __APP_VERSION__: JSON.stringify(pkg.version) })
const APP_VERSION = window.__APP_VERSION__ || 'dev';

type RUMEvent = {
  type: 'navigation' | 'action';
  name: string;
  ts: number;
  durationMs?: number;
  meta?: Record<string, any>;
};

const buffer: RUMEvent[] = [];
// Stable session correlation for this page lifetime (distinct from per-request correlation IDs)
const sessionCorrelationId = (() => {
  try { return (globalThis as any).crypto?.randomUUID?.() || 'sess_' + Math.random().toString(36).slice(2); } catch { return 'sess_' + Math.random().toString(36).slice(2); }
})();
let flushTimer: any = null;
const FLUSH_INTERVAL = 10000;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL);
}

// Capture global errors
window.addEventListener('error', (e) => {
  try { buffer.push({ type:'action', name:'error', ts:Date.now(), meta:{ message:e.message, filename:e.filename, lineno:e.lineno } }); scheduleFlush(); } catch {}
});
window.addEventListener('unhandledrejection', (e:any) => {
  try { buffer.push({ type:'action', name:'unhandledrejection', ts:Date.now(), meta:{ reason: String(e.reason) } }); scheduleFlush(); } catch {}
});

// Long task observer (if supported)
try {
  // @ts-ignore PerformanceObserver global typed in lib.dom
  const po = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if ((entry as any).duration) buffer.push({ type:'action', name:'longtask', ts:Date.now(), durationMs: Math.round((entry as any).duration) });
    }
    scheduleFlush();
  });
  // @ts-ignore
  po.observe({ type:'longtask', buffered:true });
} catch {}

export function recordNavigation(name: string) {
  try {
    const perfNav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const duration = perfNav ? Math.round(perfNav.domContentLoadedEventEnd - perfNav.startTime) : undefined;
    buffer.push({ type:'navigation', name, ts: Date.now(), durationMs: duration });
    scheduleFlush();
  } catch {}
}

export function recordAction(name: string, meta: Record<string, any> = {}, start?: number) {
  try {
    // Try to read role/token presence from localStorage quickly (avoids needing React context here)
    const role = (window as any).__AUTH_ROLE__ || localStorage.getItem('__auth_role_cache') || null;
    if (role) meta.role = role;
    if (lastCorrelationId && !meta.correlationId) meta.correlationId = lastCorrelationId;
  } catch {}
  const durationMs = start ? Math.round(performance.now() - start) : undefined;
  buffer.push({ type:'action', name, ts: Date.now(), durationMs, meta });
  if (buffer.length > 20) void flush(); else scheduleFlush();
}

async function flush() {
  flushTimer && clearTimeout(flushTimer); flushTimer = null;
  if (!buffer.length) return;
  const payload = buffer.splice(0, buffer.length).map(e => ({ ...e, v: APP_VERSION, correlationId: e.meta?.correlationId || lastCorrelationId || sessionCorrelationId }));
  try {
    // Correct backend mount is /api/v1/users/metrics/rum (userRoutes mounted under /api/v1/users)
    const primaryUrl = `${API_BASE}/users/metrics/rum`;
    const res = await fetch(primaryUrl, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ events: payload })
    });
    if (!res.ok && res.status === 404) {
      // Fallback for legacy or alternate mount (root level) if backend adds it later
      const fallback = `${API_BASE.replace(/\/api\/v1$/, '')}/metrics/rum`;
      try { await fetch(fallback, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ events: payload }) }); } catch {}
    }
  } catch { /* swallow network errors silently */ }
}

// Visibility flush
['visibilitychange','beforeunload','pagehide'].forEach(evt => {
  window.addEventListener(evt, () => { if (document.visibilityState === 'hidden' || evt !== 'visibilitychange') flush(); }, { capture:true });
});

// Auto navigation metric on load
recordNavigation(window.location.pathname || 'initial');

// Hook to keep role cached when auth profile loads (optional usage in AuthProvider)
export function cacheUserRole(role?: string) {
  try { if (role) { (window as any).__AUTH_ROLE__ = role; localStorage.setItem('__auth_role_cache', role); } } catch {}
}

export function useRUMAction(name: string) {
  return () => recordAction(name);
}
