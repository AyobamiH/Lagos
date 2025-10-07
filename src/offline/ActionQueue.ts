// Unified action queue handling offline and rate-limited retries.
// Persists minimal metadata to localStorage.
// (No direct API import here; processing is delegated via injected deps to keep queue generic)

export type ActionKind = 'feedback_submit' | 'ride_request' | 'driver_location_ping' | 'driver_lifecycle';
export interface QueuedActionBase {
  id: string;
  kind: ActionKind;
  createdAt: number;
  attempts: number;
  payload: any;
  lastError?: string;
  dedupeKey?: string; // identical logical action grouping
  nextEligibleAt?: number; // backoff scheduling
  reasonDropped?: string; // terminal reason
}

// Specific payload shapes for stronger typing
export interface FeedbackPayload { message: string; }
export interface RideRequestPayload { pickup: any; dropoff: any; productType: string; paymentMethod?: string; }
export interface DriverLocationPayload { lat: number; lng: number; }
export interface DriverLifecyclePayload { rideId: string; op: string; }

interface PersistShape { v: number; items: QueuedActionBase[]; }
const STORAGE_KEY = 'action_queue_v1';

function load(): QueuedActionBase[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return []; const parsed: PersistShape = JSON.parse(raw); if (parsed.v === 1 && Array.isArray(parsed.items)) return parsed.items; } catch {}
  return [];
}
function save(items: QueuedActionBase[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v:1, items })); } catch {} }

let queue: QueuedActionBase[] = load();
// Dead-letter buffer (in-memory; could persist if needed)
export const deadLetter: QueuedActionBase[] = [];

const CAPS: Record<ActionKind, number> = {
  feedback_submit: 50,
  ride_request: 25,
  driver_location_ping: 100,
  driver_lifecycle: 30
};

export function snapshotQueue(): QueuedActionBase[] { return [...queue]; }
export function size() { return queue.length; }

function makeDedupeKey(kind: ActionKind, payload: any): string | undefined {
  try {
    if (kind === 'ride_request') {
      const p = payload || {};
      const { pickup, dropoff, productType } = p;
      if (pickup && dropoff) {
        return `ride:${pickup.lat},${pickup.lng}->${dropoff.lat},${dropoff.lng}:${productType||'standard'}`;
      }
    } else if (kind === 'feedback_submit') {
      if (payload && typeof payload.message === 'string') {
        return 'fb:' + payload.message.trim().slice(0,140);
      }
    } else if (kind === 'driver_location_ping') {
      if (payload && typeof payload.lat === 'number' && typeof payload.lng === 'number') {
        // collapse multiple identical lat/lng pings to avoid queue growth offline
        return `loc:${payload.lat.toFixed(5)},${payload.lng.toFixed(5)}`;
      }
    } else if (kind === 'driver_lifecycle') {
      if (payload && payload.rideId && payload.op) {
        return `dl:${payload.rideId}:${payload.op}`;
      }
    }
  } catch {}
  return undefined;
}

function enqueue(kind: ActionKind, payload: FeedbackPayload | RideRequestPayload | DriverLocationPayload | DriverLifecyclePayload) {
  const dedupeKey = makeDedupeKey(kind, payload);
  if (dedupeKey) {
    // If an identical pending action exists, do not enqueue duplicate
    const exists = queue.some(q => q.kind === kind && q.dedupeKey === dedupeKey);
    if (exists) return null;
  }
  // Enforce cap per kind: drop oldest of same kind if at capacity
  const cap = CAPS[kind];
  if (cap && queue.filter(q=>q.kind===kind).length >= cap) {
    // remove oldest of that kind
    let idx = -1; let oldest = Infinity;
    queue.forEach((q,i)=>{ if (q.kind===kind && q.createdAt < oldest) { oldest = q.createdAt; idx = i; } });
    if (idx >=0) {
      const dropped = queue.splice(idx,1)[0];
      dropped.reasonDropped = 'cap_exceeded';
      deadLetter.push(dropped);
    }
  }
  const item: QueuedActionBase = { id: `${kind}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, kind, createdAt: Date.now(), attempts: 0, payload, dedupeKey };
  queue.push(item); save(queue); return item.id;
}

export function enqueueFeedback(payload: FeedbackPayload) { return enqueue('feedback_submit', payload); }
export function enqueueRideRequest(payload: RideRequestPayload) { return enqueue('ride_request', payload); }
export function enqueueDriverLocation(payload: DriverLocationPayload) { return enqueue('driver_location_ping', payload); }
export function enqueueDriverLifecycle(payload: DriverLifecyclePayload) { return enqueue('driver_lifecycle', payload); }

export interface ProcessorDeps {
  submitFeedback: (message:string) => Promise<any>;
  requestRide: (payload: RideRequestPayload) => Promise<any>;
  sendDriverLocation: (payload: DriverLocationPayload) => Promise<any>;
  driverLifecycle: (payload: DriverLifecyclePayload) => Promise<any>;
  isRateLimited: () => boolean;
}

export interface ProcessResult { processed: number; remaining: number; };

export async function processAll(deps: ProcessorDeps): Promise<ProcessResult> {
  const remaining: QueuedActionBase[] = [];
  let processed = 0;
  const now = Date.now();
  for (const item of queue) {
    // Respect backoff scheduling
    if (item.nextEligibleAt && item.nextEligibleAt > now) { remaining.push(item); continue; }
    // Rate limit guard: skip but don't consume attempt
    if (deps.isRateLimited()) { remaining.push(item); continue; }
    try {
  if (item.kind === 'feedback_submit') await deps.submitFeedback(item.payload.message);
  else if (item.kind === 'ride_request') await deps.requestRide(item.payload);
  else if (item.kind === 'driver_location_ping') await deps.sendDriverLocation(item.payload);
  else if (item.kind === 'driver_lifecycle') await deps.driverLifecycle(item.payload);
      processed++;
    } catch (e:any) {
      item.attempts += 1;
      const code = e?.code || e?.error;
      const status = e?.status;
      item.lastError = e?.friendlyMessage || e?.message || code || 'error';
      // Terminal errors: do not retry (validation / immutable / forbidden / not_found / bad_request)
  const terminalCodes = ['validation_failed','immutable_state','forbidden','not_found','bad_request','invalid_state','payment_method_required','conflict_version'];
      const isRateLimited = code === 'rate_limited' || status === 429;
      const transient5xx = status && status >=500;
      const concurrentConflict = code === 'concurrent_update' || status === 409;
      const precondition = code === 'precondition_failed' || status === 412;
      const terminal = terminalCodes.includes(code) && !isRateLimited;
      if (terminal) {
        item.reasonDropped = code || 'terminal';
        deadLetter.push(item);
        try { window.dispatchEvent(new CustomEvent('actionQueue:deadLetter', { detail: { item } })); } catch {}
        continue; // do not re-add
      }
      // For rate limit respect server Retry-After header first
      if (isRateLimited) {
        const retry = e?.retryAfterMs || 5000; // fallback 5s
        item.nextEligibleAt = Date.now() + retry;
        remaining.push(item);
        continue;
      }
      // For conflicts or preconditions we surface once then drop (caller should re-drive with fresh data)
      if (concurrentConflict || precondition) {
        item.reasonDropped = code || 'conflict';
        deadLetter.push(item);
        try { window.dispatchEvent(new CustomEvent('actionQueue:deadLetter', { detail: { item } })); } catch {}
        continue;
      }
      // Generic transient/backoff path (network, 5xx etc.)
      const baseDelay = 5000 * Math.pow(2, item.attempts - 1); // exponential
      const jitter = baseDelay * (0.75 + Math.random()*0.5);
      const delay = Math.min(120_000, jitter);
      const serverRetry = e?.retryAfterMs || 0;
      item.nextEligibleAt = Date.now() + Math.max(delay, serverRetry);
      remaining.push(item);
    }
  }
  queue = remaining; save(queue);
  return { processed, remaining: queue.length };
}

export function drop(id: string) { queue = queue.filter(q => q.id !== id); save(queue); }
export function clearAll() { queue = []; save(queue); }
