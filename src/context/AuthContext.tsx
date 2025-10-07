import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { api, registerApiHooks, injectTokenAccessors, lastCorrelationId } from '../api/client';
import { cacheUserRole } from '../rum/clientRUM';
import { useRateLimit } from './RateLimitContext';
import { useToast } from './ToastContext';
import { t } from '../i18n/messages';

interface AuthState {
  token: string | null;
  profile: any | null;
  hasScope: (s: string) => boolean;
  hasCardCapability?: boolean;
  signup: (name: string, phone: string, password: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  driverSignup: (name: string, phone: string, password: string) => Promise<void>;
  driverLogin: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  error: string | null;
  errorDetails?: any[] | null;
  loading: boolean;
  isDriver: boolean;
}

const Ctx = createContext<AuthState>(null as any);

export const AuthProvider: React.FC<{ children: React.ReactNode; initialToken?: string }> = ({ children, initialToken }) => {
  // In-memory tokens (no longer persisted in localStorage for improved security)
  const [token, setToken] = useState<string | null>(initialToken || null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  // Keep refs so api layer (attemptRefresh) can always read latest without prop drilling
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<any[]|null>(null);
  const { push } = useToast();
  const rl = useRateLimit();
  if (!push) {
    // Should not happen with new default, but guard just in case
    // eslint-disable-next-line no-console
    console.warn('[auth] toast context push missing');
  }

  async function refreshProfile() {
    if (!token) return;
    try {
      // First try rider profile
      try {
        const p = await api.profile(token);
        if (p) {
          setProfile(p);
          cacheUserRole(p?.role);
          return;
        }
      } catch (e:any) {
        // fall through to driver profile on 401/403/not_found
      }
      // Fallback: driver profile
      try {
        const d = await api.driverMe(token);
        // Normalize to a shared shape with explicit role
        const prof = d?.driver ? { ...d.driver, role: 'driver' } : { ...(d||{}), role: 'driver' };
        setProfile(prof);
        cacheUserRole('driver');
        return;
      } catch (e:any) {
        if (e?.status === 401) { logout(); return; }
        // Keep previous profile if any, but surface an error toast via API hook
      }
    } catch (e:any) {
      if (e?.status === 401) logout();
    }
  }

  useEffect(() => { if (token) { console.log('[auth] token present, fetching profile'); refreshProfile(); } }, [token]);
  // Attempt a one-time bootstrap from server-provided access token (if any) via a custom header exposed by backend preview or dev cookie flow.
  useEffect(() => {
    if (token) return;
    let cancelled = false;
    (async () => {
      try {
        // Probe a lightweight endpoint to see if server echoes an access token in headers (dev helper). This is optional and safe.
        const res = await fetch('/api/ping', { method: 'GET' }).catch(() => null as any);
        const maybe = res?.headers?.get?.('x-dev-access');
        if (maybe && !cancelled) {
          applyTokens(maybe, null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register API hooks (only once)
  useEffect(() => {
    registerApiHooks({
      onUnauthorized: () => {
  push({ message: t('session_expired'), type: 'error' });
        logout();
      },
      onError: (err: any) => {
        const ref = lastCorrelationId ? ` (ref: ${lastCorrelationId})` : '';
        if (err?.status === 0 && err?.error === 'offline') {
          push({ message: t('offline')+ref, type: 'error' });
        }
        if (err?.status === 429 && err?.retryAfterMs) {
          rl.trigger(err.retryAfterMs);
          push({ message: `${t('rate_limited')} Retry in ${Math.ceil(err.retryAfterMs/1000)}s${ref}`, type: 'error', ttl: err.retryAfterMs });
        }
        if (err?.friendlyMessage && ![0,429].includes(err.status)) {
          push({ message: `${err.friendlyMessage}${ref}`, type: 'error' });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validatePhone(phone: string) {
    // Mirror backend basic normalization rules (digits + optional +, length after normalization 8-16)
    const cleaned = phone.trim();
    if (!/^\+?[0-9]{6,20}$/.test(cleaned.replace(/[^0-9+]/g,''))) return 'invalid_phone_format';
    return null;
  }
  function validatePassword(pw: string) {
    if (pw.length < 8) return 'min_length_8';
    return null;
  }

  function applyTokens(access?: string|null, refresh?: string|null) {
    if (typeof access !== 'undefined') { setToken(access); accessRef.current = access; }
    if (typeof refresh !== 'undefined') { setRefreshToken(refresh); refreshRef.current = refresh; }
  }

  // Provide token getters/setters to api module (one-time)
  useEffect(() => {
    injectTokenAccessors({
      getAccess: () => accessRef.current,
      getRefresh: () => refreshRef.current,
  setAccess: (t: string | null) => applyTokens(t, undefined),
  setRefresh: (rt: string | null) => applyTokens(undefined, rt)
    });
  }, []);

  async function baseSignup(kind:'rider'|'driver', name: string, phone: string, password: string) {
  setLoading(true); setError(null); setErrorDetails(null);
    try {
      const pErr = validatePhone(phone); if (pErr) throw { error: pErr };
      const pwErr = validatePassword(password); if (pwErr) throw { error: pwErr };
      const r = kind==='driver' ? await api.driverSignup({ name, phone, password }) : await api.signup({ name, phone, password });
      const access = (r as any).accessToken || r.token;
      const refresh = (r as any).refreshToken;
      applyTokens(access || null, refresh || null);
  await refreshProfile();
    } catch (e: any) {
      setError(e.error || 'signup_failed');
      if (e.details && Array.isArray(e.details)) setErrorDetails(e.details);
    } finally { setLoading(false); }
  }
  async function signup(name: string, phone: string, password: string) { return baseSignup('rider', name, phone, password); }
  async function driverSignup(name: string, phone: string, password: string) { return baseSignup('driver', name, phone, password); }

  async function baseLogin(kind:'rider'|'driver', phone: string, password: string) {
  setLoading(true); setError(null); setErrorDetails(null);
    try {
      const pErr = validatePhone(phone); if (pErr) throw { error: pErr };
      const pwErr = validatePassword(password); if (pwErr) throw { error: pwErr };
      const r = kind==='driver' ? await api.driverLogin({ phone, password }) : await api.login({ phone, password });
      const access = (r as any).accessToken || r.token;
      const refresh = (r as any).refreshToken;
      applyTokens(access || null, refresh || null);
      await refreshProfile();
    } catch (e: any) {
      setError(e.error || 'login_failed');
      if (e.details && Array.isArray(e.details)) setErrorDetails(e.details);
    } finally { setLoading(false); }
  }
  async function login(phone: string, password: string) { return baseLogin('rider', phone, password); }
  async function driverLogin(phone: string, password: string) { return baseLogin('driver', phone, password); }

  function logout() {
    applyTokens(null, null);
    setProfile(null);
    try {
      // Notify service worker (if controlling) to purge caches
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type:'LOGOUT_PURGE' });
      }
    } catch { /* ignore purge errors */ }
  }

  const isDriver = !!profile?.role && profile.role === 'driver';
  function hasScope(scope: string) { return Array.isArray(profile?.scopes) ? profile.scopes.includes(scope) : false; }
  const hasCardCapability = Array.isArray(profile?.paymentMethods) ? profile.paymentMethods.includes('card') : false;
  return (
  <Ctx.Provider value={{ token, profile, hasScope, hasCardCapability, signup, login, driverSignup, driverLogin, logout, refreshProfile, error, errorDetails, loading, isDriver }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
