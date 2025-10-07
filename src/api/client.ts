// Prefer env for API base; fall back to local dev
const __API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
// Derive legacy base from API base by default to keep hosts consistent (overrideable via env)
const __LEGACY_DERIVED = __API_BASE.replace(/\/$/, '').replace(/\/api\/v1$/, '/api');
export const API_BASE = __API_BASE;
// Legacy base for select endpoints (e.g., pricing quote)
export const LEGACY_API_BASE = (import.meta as any).env?.VITE_API_BASE_LEGACY || __LEGACY_DERIVED || 'http://localhost:5000/api';
import { AuthResponseSchema, extractAccessToken, RidesPageSchema, RideDetailSchema, RideRequestResponseSchema, ErrorResponseSchema, QuoteSchema, FeedbackItemSchema, ReceiptSchema, AvailabilitySnapshotSchema, FeatureFlagsSchema, DiagnosticsSchema, PaymentSchema, AdjustmentSchema, SurgeVersionSchema, ManualAssignResultSchema } from './schemas';

// Central lightweight error code -> user message mapping (Step 4 prep; i18n extraction later)
const ERROR_MESSAGES: Record<string,string> = {
  validation_failed: 'Some inputs are invalid.',
  unauthorized: 'Please log in again.',
  forbidden: 'You do not have permission to perform this action.',
  not_found: 'Resource not found.',
  rate_limited: 'Too many requests. Please slow down.',
  offline: 'You appear to be offline.',
  schema_invalid_rides: 'Unexpected data format for rides list.',
  schema_invalid_ride: 'Unexpected data format for ride.',
  schema_invalid_ride_request: 'Unexpected data format for ride request.',
  precondition_failed: 'Ride was updated elsewhere. Refreshed to latest.',
  concurrent_update: 'Another update happened at the same time. Please retry.',
  immutable_state: 'Ride can no longer be modified in its current state.',
  bad_request: 'Request was malformed.',
  cors_blocked: 'Request blocked by CORS policy.',
  internal_error: 'Something went wrong. Try again later.',
  // Added granular domain errors (quotes / payments / refresh / feedback conflicts etc.)
  invalid_state: 'Action invalid in current state.',
  payment_method_required: 'A valid payment method is required.',
  expired_quote: 'Quote expired. Recalculating…',
  invalid_quote_signature: 'Quote signature invalid. Please retry.',
  quote_mismatch: 'Quote details mismatch. Refreshing pricing…',
  quote_replay_detected: 'Quote reuse detected. Fetch a new quote.',
  stateless_required_missing_payload: 'Signed quote payload required.',
  invalid_quote_payload: 'Quote payload invalid.',
  capture_exceeds_remaining: 'Capture exceeds remaining amount.',
  refund_exceeds_captured: 'Refund exceeds captured amount.',
  invalid_amount: 'Invalid amount.',
  conflict_version: 'Item changed elsewhere. Please refresh.',
  missing_refresh: 'Refresh token missing.',
  invalid_refresh: 'Refresh token invalid.',
  expired_refresh: 'Refresh token expired. Please login again.',
  logout_failed: 'Logout failed. Session will expire automatically.',
  edit_conflict_refresh: 'Item changed elsewhere. Showing latest – re-apply your edits.'
};

export interface StructuredApiError extends Error {
  status?: number;
  code?: string;
  error?: string;
  details?: any;
  friendlyMessage?: string;
  schemaValidation?: boolean; // true when client-side schema parse failed
  retryAfterMs?: number;
  correlationId?: string;
}

// Hooks registration so UI layers (Auth / Toast) can react to request lifecycle without circular deps
type ApiHooks = { onUnauthorized?: () => void; onError?: (err: any) => void };
let hooks: ApiHooks = {};
export function registerApiHooks(h: ApiHooks) { hooks = h; }
// Global last correlation ID for observability surfaces (RUM, diagnostics, toasts)
export let lastCorrelationId: string | null = null;
let lastResponseHeaders: Record<string,string> = {};
export function getLastResponseHeaders() { return { ...lastResponseHeaders }; }

interface RetryOptions { attempts: number; backoffBaseMs: number; }
const DEFAULT_RETRY: RetryOptions = { attempts: 2, backoffBaseMs: 250 };

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// In-memory token accessors injected by AuthContext (allows us to remove localStorage persistence for access token)
interface TokenAccessors {
  getAccess: () => string | null;
  getRefresh: () => string | null;
  setAccess: (v: string | null) => void;
  setRefresh: (v: string | null) => void;
}
let tokenAccess: TokenAccessors | null = null;
export function injectTokenAccessors(a: TokenAccessors) { tokenAccess = a; }

let refreshPromise: Promise<string | null> | null = null;
async function attemptRefresh(): Promise<string | null> {
  const currentRefresh = tokenAccess?.getRefresh();
  if (!currentRefresh) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ refreshToken: currentRefresh }) });
        const text = await res.text();
        let json: any = {}; try { json = text ? JSON.parse(text):{}; } catch{}
        if (!res.ok) return null;
        const parsed = AuthResponseSchema.safeParse(json);
        if (!parsed.success) return null;
        const access = extractAccessToken(parsed.data);
        if (access) tokenAccess?.setAccess(access);
        if (parsed.data.refreshToken) tokenAccess?.setRefresh(parsed.data.refreshToken);
        return access || null;
      } catch { return null; } finally { refreshPromise = null; }
    })();
  }
  return refreshPromise;
}

// Simple correlation ID generator (base36 slice for brevity)
function newCorrelationId() { return Math.random().toString(36).slice(2,10); }

interface ExtraOptions extends RequestInit { etag?: string; }
// Simple ephemeral ETag->body cache scoped by auth identity (access token slice) to avoid cross-user bleed.
// Key format: `${path}::${accessToken?.slice(0,16) || 'anon'}`
const etagCache: Map<string, { etag:string; body:any; at:number; tokenFrag:string } > = new Map();
async function request(path: string, options: ExtraOptions = {}, retry: Partial<RetryOptions> = {}) {
  const cfg: RetryOptions = { ...DEFAULT_RETRY, ...retry };
  const isIdempotent = !options.method || options.method === 'GET';
  let attempt = 0;
  let lastErr: any;
  // Capture caller headers (will mutate per-attempt for auth refresh & correlation)
  let baseHeaders = { ...(options.headers || {}) } as Record<string,string>;
  const correlationId = newCorrelationId();
  while (attempt <= cfg.attempts) {
    if (!navigator.onLine) {
      const offlineErr = { status: 0, error: 'offline' };
      hooks.onError?.(offlineErr);
      throw offlineErr;
    }
    try {
      const startedAt = Date.now();
      const authToken = tokenAccess?.getAccess();
  const headers: Record<string,string> = { 'Content-Type':'application/json', ...baseHeaders, 'X-Correlation-ID': correlationId };
  if ((options as any).etag) headers['If-None-Match'] = (options as any).etag as string;
      if (authToken && !headers.Authorization) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      // Attempt server error shape normalization
      const parsedErr = ErrorResponseSchema.safeParse(data);
      if (parsedErr.success) data = parsedErr.data;
      // Fast-path 304 (not modified) with hydrated cached body if present
      if (res.status === 304) {
        lastCorrelationId = correlationId;
        try { lastResponseHeaders = {}; res.headers.forEach((v,k)=>{ lastResponseHeaders[k.toLowerCase()] = v; }); } catch { lastResponseHeaders = {}; }
        const etag = lastResponseHeaders['etag'];
        if (etag) {
          const tokenFrag = (tokenAccess?.getAccess() || 'anon').slice(0,16);
          const cacheKey = `${path}::${tokenFrag}`;
          if (etagCache.has(cacheKey)) {
            const cached = etagCache.get(cacheKey)!;
            return { ...cached.body, __notModified: true };
          }
        }
        return { __notModified: true } as any;
      }
      if (res.status === 401) {
        // Attempt silent refresh once if we have a refresh token
        const maybeNew = await attemptRefresh();
        if (maybeNew) {
          // Always retry with new token (if original intended to be authed)
          if (authToken) {
            baseHeaders = { ...baseHeaders, Authorization: `Bearer ${maybeNew}` };
            attempt++; // count the refresh-driven retry as next attempt
            continue;
          }
        }
        hooks.onUnauthorized?.();
        throw { status: 401, ...data };
      }
      if (!res.ok) {
        const retryAfterHeader = res.headers.get('Retry-After');
        let retryAfterMs: number | undefined;
        if (retryAfterHeader) {
          const asInt = parseInt(retryAfterHeader,10);
            if (!isNaN(asInt)) retryAfterMs = asInt * 1000;
        }
        const errObj: StructuredApiError = { name:'ApiError', status: res.status, ...(data||{}), retryAfterMs };
        const code = (errObj.code || errObj.error || '').trim();
        if (code && ERROR_MESSAGES[code]) errObj.friendlyMessage = ERROR_MESSAGES[code];
        else if (ERROR_MESSAGES[String(errObj.status)]) errObj.friendlyMessage = ERROR_MESSAGES[String(errObj.status)];
        // Retry on transient server/network issues for idempotent requests
        if (isIdempotent && [502,503,504].includes(res.status) && attempt < cfg.attempts) {
          attempt++;
          const delay = cfg.backoffBaseMs * Math.pow(2, attempt-1);
          await sleep(delay);
          continue;
        }
        hooks.onError?.(errObj);
        throw errObj;
      }
      // Attach correlation ID & cache by ETag for idempotent GET requests
      if (data && typeof data === 'object') { (data as any).__cid = correlationId; }
      if (isIdempotent) {
        const etag = res.headers.get('ETag');
        if (etag) {
          try {
            const tokenFrag = (tokenAccess?.getAccess() || 'anon').slice(0,16);
            const cacheKey = `${path}::${tokenFrag}`;
            etagCache.set(cacheKey, { etag, body: data, at: Date.now(), tokenFrag });
          } catch {}
        }
      }
      lastCorrelationId = correlationId;
      // Capture headers for ETag and diagnostics (case-normalized)
      try { lastResponseHeaders = {}; res.headers.forEach((v,k)=>{ lastResponseHeaders[k.toLowerCase()] = v; }); } catch { lastResponseHeaders = {}; }
      try { window.dispatchEvent(new CustomEvent('api:success', { detail: { path, status: res.status, correlationId, headers: lastResponseHeaders } })); } catch {}
      return data;
    } catch (e: any) {
      lastErr = e;
      if (e && typeof e === 'object') (e as any).correlationId = correlationId;
      lastCorrelationId = correlationId;
      // Network error (no status) - retry if idempotent
      if (isIdempotent && (!e.status || e.status === 0) && attempt < cfg.attempts) {
        attempt++;
        const delay = cfg.backoffBaseMs * Math.pow(2, attempt-1);
        await sleep(delay);
        continue;
      }
      if (e && !e.friendlyMessage) {
        const code = (e.code || e.error || '').trim();
        if (code && ERROR_MESSAGES[code]) e.friendlyMessage = ERROR_MESSAGES[code];
        else if (ERROR_MESSAGES[String(e.status)]) e.friendlyMessage = ERROR_MESSAGES[String(e.status)];
      }
      hooks.onError?.(e);
      try { window.dispatchEvent(new CustomEvent('api:error', { detail: { path, status: e?.status, code: e?.code||e?.error, correlationId, friendlyMessage: e?.friendlyMessage } })); } catch {}
      throw e;
    }
  }
  throw lastErr || { status: 500, error: 'unknown_error' };
}

// Minimal legacy requester for endpoints mounted at /api (not /api/v1). Keeps basic behavior
async function requestLegacy(path: string, options: ExtraOptions = {}, retry: Partial<RetryOptions> = {}) {
  const cfg: RetryOptions = { ...DEFAULT_RETRY, ...retry };
  const isIdempotent = !options.method || options.method === 'GET';
  let attempt = 0;
  let lastErr: any;
  const correlationId = newCorrelationId();
  let baseHeaders = { ...(options.headers || {}) } as Record<string,string>;
  while (attempt <= cfg.attempts) {
    try {
      const authToken = tokenAccess?.getAccess();
      const headers: Record<string,string> = { 'Content-Type':'application/json', ...baseHeaders, 'X-Correlation-ID': correlationId };
      if (authToken && !headers.Authorization) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${LEGACY_API_BASE}${path}`, { ...options, headers });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) {
        const errObj: StructuredApiError = { name:'ApiError', status: res.status, ...(data||{}) };
        const code = (errObj.code || errObj.error || '').trim();
        if (code && ERROR_MESSAGES[code]) errObj.friendlyMessage = ERROR_MESSAGES[code];
        if (isIdempotent && [502,503,504].includes(res.status) && attempt < cfg.attempts) {
          attempt++;
          const delay = cfg.backoffBaseMs * Math.pow(2, attempt-1);
          await sleep(delay);
          continue;
        }
        throw errObj;
      }
      if (data && typeof data === 'object') { (data as any).__cid = correlationId; }
      return data;
    } catch (e:any) {
      lastErr = e;
      if (isIdempotent && (!e.status || e.status === 0) && attempt < cfg.attempts) {
        attempt++;
        const delay = cfg.backoffBaseMs * Math.pow(2, attempt-1);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || { status: 500, error: 'unknown_error' };
}

import type { UserProfile, FeedbackItem, QuoteResponse, RideRequestResponse } from '../types/api';

// Exporting the low-level request for advanced hooks/utilities (e.g. useFetch)
export { request };

export const api = {
  signup: (payload: { name: string; phone: string; password: string }): Promise<{ token: string }> =>
    request('/users/signup', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { phone: string; password: string }): Promise<{ token: string }> =>
    request('/users/login', { method: 'POST', body: JSON.stringify(payload) }),
  profile: (token: string): Promise<UserProfile> =>
    request('/users/profile', { headers: { Authorization: `Bearer ${token}` } }),
  ridesPage: (token: string, cursor?: string|null, status?: string, etag?: string) =>
    request(`/rides${(() => { const params = new URLSearchParams(); if (cursor) params.set('cursor', cursor); if (status) params.set('status', status); const qs = params.toString(); return qs ? `?${qs}` : ''; })()}` , { headers:{ Authorization:`Bearer ${token}` }, etag })
  .then(j => { const parsed = RidesPageSchema.safeParse(j); if (!parsed.success) { const err: StructuredApiError = { name:'SchemaError', message:'Invalid rides page schema', status:500, error:'schema_invalid_rides', schemaValidation:true, friendlyMessage: ERROR_MESSAGES.schema_invalid_rides }; throw err; } return parsed.data; }),
  rideDetail: (token: string, rideId: string) =>
    request(`/rides/${rideId}`, { headers:{ Authorization:`Bearer ${token}` } })
  .then(j => { const parsed = RideDetailSchema.safeParse(j.ride? j.ride : j); if (!parsed.success) { const err: StructuredApiError = { name:'SchemaError', message:'Invalid ride detail schema', status:500, error:'schema_invalid_ride', schemaValidation:true, friendlyMessage: ERROR_MESSAGES.schema_invalid_ride }; throw err; } return parsed.data; }),
  getQuote: (payload: { pickup: { lat:number; lng:number }, dropoff:{ lat:number; lng:number }, productType:string }) =>
    requestLegacy(`/pricing/quote`, { method:'POST', body: JSON.stringify(payload) })
      .then(j => { const parsed = QuoteSchema.safeParse(j); if (!parsed.success) { const err: StructuredApiError = { name:'SchemaError', message:'Invalid quote schema', status:500, error:'schema_invalid_quote', schemaValidation:true, friendlyMessage:'Quote data invalid' }; throw err; } return parsed.data; }),
  listMyFeedback: (token: string): Promise<{ items: any[] }> =>
    request('/feedback/mine', { headers:{ Authorization:`Bearer ${token}` } })
      .then(j => {
        if (Array.isArray(j.items)) {
          const good = j.items
            .map((it: any) => FeedbackItemSchema.safeParse(it))
            .filter((r: any) => r.success)
            .map((r: any) => (r.success ? r.data : null));
          return { items: good };
        }
        return { items: [] };
      }),
  submitFeedback: (token: string, message: string): Promise<FeedbackItem> =>
    request('/feedback', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ message }) }),
  updateFeedback: (token: string, id: string, message: string, createdAt: string): Promise<FeedbackItem> =>
    request(`/feedback/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ message, lastKnownCreatedAt: createdAt }) }),
  deleteFeedback: (token: string, id: string): Promise<{ ok: boolean }> =>
    request(`/feedback/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  receipt: (token: string, rideId: string) =>
    request(`/rides/${rideId}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(j => { const parsed = ReceiptSchema.safeParse(j.receipt ? j.receipt : j.ride || j); if (parsed.success) return parsed.data; return { rideId }; }),
  rideRequest: (token: string, payload: { pickup:{lat:number;lng:number}; dropoff:{lat:number;lng:number}; productType?:string; paymentMethod?:string; quotePayload?:any; quoteSignature?:string; quoteId?:string }) =>
    request(`/rides/request`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) })
      .then(j => { const parsed = RideRequestResponseSchema.safeParse(j); if (!parsed.success) { const err: StructuredApiError = { name:'SchemaError', message:'Invalid ride request response schema', status:500, error:'schema_invalid_ride_request', schemaValidation:true, friendlyMessage:'Ride request response invalid' }; throw err; } return parsed.data; }),
  logout: (token: string) =>
    request(`/auth/logout`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({}) }).catch(e => { /* tolerate 4xx */ return { revoked:false, error: e?.code||e?.error }; }),
  availability: (token: string) =>
    request(`/drivers/availability`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(j => { const parsed = AvailabilitySnapshotSchema.safeParse(j); if (parsed.success) return parsed.data; return j; }),
  featureFlags: (token: string) =>
    request(`/feature-flags`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(j => { const parsed = FeatureFlagsSchema.safeParse(j); if (parsed.success) return parsed.data; return {}; }),
  diagnostics: (token: string) =>
    request(`/internal/diagnostics`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(j => { const parsed = DiagnosticsSchema.safeParse(j); if (parsed.success) return parsed.data; return j; })
  ,
  patchRide: (token: string, rideId: string, patch: { productType?:string; dropoff?: { lat:number; lng:number } }, etag?: string) =>
    request(`/rides/${rideId}`, { method:'PATCH', headers:{ Authorization:`Bearer ${token}`, ...(etag? { 'If-Match': etag }: {}) }, body: JSON.stringify(patch) })
      .then(j => {
        // Normalize backend field drift (eta vs etaMinutes) to a consistent key: etaMinutes
        try {
          if (j && typeof j === 'object') {
            if ('eta' in j && !('etaMinutes' in j)) (j as any).etaMinutes = (j as any).eta;
          }
        } catch {}
        return j;
      })
  ,
  // --- Driver side APIs ---
  driverSignup: (payload:{ name:string; phone:string; password:string }) =>
    request('/drivers/signup', { method:'POST', body: JSON.stringify(payload) }),
  driverLogin: (payload:{ phone:string; password:string }) =>
    request('/drivers/login', { method:'POST', body: JSON.stringify(payload) }),
  driverMe: (token:string) => request('/drivers/me', { headers:{ Authorization:`Bearer ${token}` } }),
  driverAvailability: (token:string) => request('/drivers/availability', { headers:{ Authorization:`Bearer ${token}` } }),
  driverUpdateLocation: (token:string, lat:number, lng:number) =>
    request('/drivers/location', { method:'PATCH', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ lat, lng }) }),
  driverAcceptRide: (token:string, rideId:string) =>
    request(`/rides/${rideId}/accept`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } }),
  driverDeclineRide: (token:string, rideId:string) =>
    request(`/rides/${rideId}/decline`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ confirm:'decline' }) }),
  driverArrive: (token:string, rideId:string) =>
    request(`/rides/${rideId}/arrive`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({}) }),
  driverStart: (token:string, rideId:string) =>
    request(`/rides/${rideId}/start`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({}) }),
  driverComplete: (token:string, rideId:string) =>
    request(`/rides/${rideId}/complete`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({}) })
  ,
  driverRideView: (token:string, rideId:string) =>
    request(`/rides/${rideId}/driver-view`, { headers:{ Authorization:`Bearer ${token}` } })
  ,
  driverSubmitKyc: (token:string, documents: any[]) =>
    request(`/drivers/onboard/kyc`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ documents }) })
  ,
  driverApproveKyc: (token:string, driverId:string) =>
    request(`/drivers/onboard/kyc/approve`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ driverId }) })
  ,
  manualAssign: (token:string, rideId:string, driverId:string) =>
    request(`/drivers/assign`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ rideId, driverId }) })
      .then(j => { const parsed = ManualAssignResultSchema.safeParse(j); return parsed.success ? parsed.data : j; })
  ,
  // Payments
  paymentInitiate: (token:string, payload:{ rideId:string; method:string; amount?:number; currency?:string }, idempotencyKey?:string) =>
    request(`/payments`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Idempotency-Key': idempotencyKey || `init_${(globalThis as any).crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}` }, body: JSON.stringify(payload) })
      .then(j => { const p = PaymentSchema.safeParse(j); return p.success? p.data : j; })
  ,
  paymentGet: (token:string, paymentId:string, etag?:string) =>
    request(`/payments/${paymentId}`, { headers:{ Authorization:`Bearer ${token}` }, etag })
      .then(j => j.payment ? (PaymentSchema.safeParse(j.payment).success ? j.payment : j.payment) : j)
  ,
  paymentCapture: (token:string, paymentId:string, amount?:number, idempotencyKey?:string) =>
    request(`/payments/${paymentId}/capture`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Idempotency-Key': idempotencyKey || `cap_${(globalThis as any).crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}` }, body: JSON.stringify(amount? { amount } : {}) })
      .then(j => {
        // Attempt to normalize/validate capture response against PaymentSchema (drift detection)
        const parsed = PaymentSchema.safeParse(j.payment ? j.payment : j);
        return parsed.success ? (j.payment ? parsed.data : parsed.data) : j;
      })
  ,
  paymentRefund: (token:string, paymentId:string, amount?:number, idempotencyKey?:string) =>
    request(`/payments/${paymentId}/refund`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Idempotency-Key': idempotencyKey || `ref_${(globalThis as any).crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}` }, body: JSON.stringify(amount? { amount } : {}) })
      .then(j => {
        const parsed = PaymentSchema.safeParse(j.payment ? j.payment : j);
        return parsed.success ? (j.payment ? parsed.data : parsed.data) : j;
      })
  ,
  // Adjustments (rider path)
  createAdjustment: (token:string, rideId:string, payload:{ type:string; amount:number; currency?:string; note?:string; versioned?:boolean }) =>
    request(`/rides/${rideId}/adjustments${payload.versioned? '?versioned=true':''}`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) })
      .then(j => { const p = AdjustmentSchema.safeParse(j); return p.success? p.data : j; })
  ,
  reverseAdjustment: (token:string, rideId:string, version:number, reason?:string) =>
    request(`/rides/${rideId}/adjustments/reverse`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ version, reason }) })
  ,
  // Surge management (admin – no auth scope check client side; rely on backend)
  surgeListVersions: (token:string) =>
    request(`/surge/versions`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(j => Array.isArray(j?.versions||j) ? (j.versions||j).filter(Boolean).map((v:any)=> { const p = SurgeVersionSchema.safeParse(v); return p.success? p.data : v; }) : [])
  ,
  surgeUpsertVersion: (token:string, payload:{ baseMultiplier:number; notes?:string }) =>
    request(`/surge/versions`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) })
  ,
  surgeUploadOverride: (token:string, payload:{ grid:any[]; baseMultiplier:number; notes?:string; activate?:boolean }) =>
    request(`/surge/override`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) })
};

// Error classification helper for queue & UI logic
export function classifyError(e: StructuredApiError | any) {
  const code = e?.code || e?.error;
  const status = e?.status;
  const terminalCodes = ['validation_failed','immutable_state','forbidden','not_found','bad_request'];
  const rateLimited = code === 'rate_limited' || status === 429;
  const transient = (!code && !status) || (status >=500) || rateLimited;
  const conflict = code === 'concurrent_update' || status === 409;
  const precondition = code === 'precondition_failed' || status === 412;
  const terminal = terminalCodes.includes(code) && !rateLimited;
  return { terminal, transient, rateLimited, conflict, precondition };
}
