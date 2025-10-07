import { useEffect, useRef, useState, useCallback } from 'react';
import { AuthTokens, SessionMeta } from '../types/domain';

// Lightweight auth session hook implementing proactive refresh strategy.
export function useAuthSession() {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const schedule = useCallback((exp: number) => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    const now = Math.floor(Date.now()/1000);
    const delay = Math.max(1, (exp - now - 150));
    refreshTimer.current = window.setTimeout(() => { refresh().catch(()=>{}); }, delay * 1000);
  }, []);

  const applyAccessToken = useCallback((accessToken: string, refreshToken?: string) => {
    const [, payloadB64] = accessToken.split('.');
    try {
      const payload = JSON.parse(atob(payloadB64));
      setMeta({ userId: payload.userId, driverId: payload.driverId, role: payload.role, scopes: payload.scopes, exp: payload.exp });
      schedule(payload.exp);
    } catch { /* noop */ }
    setTokens(t => ({ ...(t||{}), accessToken, refreshToken: refreshToken || t?.refreshToken }));
  }, [schedule]);

  const refresh = useCallback(async () => {
    if (!tokens?.refreshToken) return;
    const res = await fetch('/api/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) });
    if (!res.ok) { setTokens(null); setMeta(null); return; }
    const data = await res.json();
    applyAccessToken(data.accessToken, data.refreshToken);
  }, [tokens, applyAccessToken]);

  const setInitialTokens = useCallback((t: AuthTokens) => { applyAccessToken(t.accessToken, t.refreshToken); }, [applyAccessToken]);

  useEffect(()=>() => { if (refreshTimer.current) window.clearTimeout(refreshTimer.current); }, []);

  return { accessToken: tokens?.accessToken || null, refreshToken: tokens?.refreshToken, meta, setInitialTokens, clear: () => { setTokens(null); setMeta(null); } };
}
