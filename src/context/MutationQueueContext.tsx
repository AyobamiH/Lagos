import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useToast } from './ToastContext';
import { enqueueFeedback, enqueueRideRequest, enqueueDriverLocation, enqueueDriverLifecycle, processAll, size, snapshotQueue } from '../offline';
import type { RideRequestPayload, DriverLocationPayload, DriverLifecyclePayload } from '../offline';
import { api, classifyError } from '../api/client';
import { useRateLimit } from './RateLimitContext';
import { useAuth } from './AuthContext';
import { t } from '../i18n/messages';

interface MutationQueueState {
  enqueueFeedback: (message: string) => void;
  enqueueRideRequest: (payload: RideRequestPayload) => { queued: boolean; id?: string|null };
  requestRideOrQueue: (payload: RideRequestPayload) => Promise<{ mode:'immediate'|'queued'; ride?: any; error?: any }>;
  sendDriverLocationOrQueue: (payload: DriverLocationPayload) => Promise<{ mode:'immediate'|'queued'; error?: any }>;
  driverLifecycleOrQueue: (payload: DriverLifecyclePayload) => Promise<{ mode:'immediate'|'queued'; error?: any }>;
  pending: number;
  processing: boolean;
  items: { id:string; kind:string; attempts:number; lastError?:string; nextEligibleAt?:number }[];
  forceDrain: () => Promise<void>;
}

const Ctx = createContext<MutationQueueState>(null as any);

export const MutationQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const { push } = useToast();
  const [pending, setPending] = useState(size());
  const [processing, setProcessing] = useState(false);
  const [items, setItems] = useState<{ id:string; kind:string; attempts:number; lastError?:string; nextEligibleAt?:number }[]>(snapshotQueue());
  const tickRef = useRef<number | null>(null);
  const rl = useRateLimit();

  async function drain() {
    if (!token) return;
    if (!size()) { setPending(0); setItems([]); return; }
    setProcessing(true);
  const before = snapshotQueue();
  const beforeIds = before.map(i=>i.id);
    await processAll({
      submitFeedback: (message: string) => api.submitFeedback(token, message),
  requestRide: (payload:RideRequestPayload) => api.rideRequest(token, payload).then(()=>Promise.resolve()),
  sendDriverLocation: (payload:DriverLocationPayload) => api.driverUpdateLocation(token, payload.lat, payload.lng),
  driverLifecycle: (payload:DriverLifecyclePayload) => {
        if (payload.op==='arrive') return api.driverArrive(token, payload.rideId);
        if (payload.op==='start') return api.driverStart(token, payload.rideId);
        if (payload.op==='complete') return api.driverComplete(token, payload.rideId);
        return Promise.resolve();
      },
      isRateLimited: () => rl.active
    });
    setProcessing(false);
    setPending(size());
    setItems(snapshotQueue().map(i => ({ id:i.id, kind:i.kind, attempts:i.attempts, lastError:i.lastError, nextEligibleAt:i.nextEligibleAt })));
    // Any IDs removed are processed successfully
    const after = snapshotQueue();
    const afterIds = new Set(after.map(i=>i.id));
    const processedIds = beforeIds.filter(id=>!afterIds.has(id));
    // Determine which were dropped terminally (had lastError set on previous snapshot)
    const terminalDropped = processedIds.filter(id => {
      const prev = before.find(b=>b.id===id);
      return prev && prev.lastError; // heuristic: had an error then disappeared
    });
    const successful = processedIds.filter(id => !terminalDropped.includes(id));
    successful.forEach(()=>push({ message:t('queued_action_processed'), type:'success' }));
  terminalDropped.forEach(()=>push({ message:t('queued_action_dropped'), type:'info' }));
  }

  useEffect(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => { if (navigator.onLine && !rl.active) drain(); }, 5000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [token, rl.active]);

  function handleEnqueueFeedback(message: string) {
    const id = enqueueFeedback({ message });
    if (id) {
      setPending(size());
      setItems(snapshotQueue());
  push({ message: t('queued_feedback'), type: 'info' });
    } else {
  push({ message: t('duplicate_feedback', 'Duplicate feedback already queued'), type: 'info' });
    }
  }

  function handleEnqueueRideRequest(payload: RideRequestPayload) {
    // Basic client-side schema alignment: paymentMethod allowlist
    if (payload.paymentMethod && !['cash','card'].includes(payload.paymentMethod)) {
      push({ message: t('invalid_payment_method', 'Invalid payment method'), type:'error' });
      return { queued:false, id:null } as any;
    }
    const id = enqueueRideRequest(payload);
    if (id) {
      setPending(size());
      setItems(snapshotQueue());
  push({ message: t('queued_ride_request'), type: 'info' });
      return { queued:true, id };
    }
  push({ message: t('duplicate_ride_request', 'Duplicate ride request already queued'), type: 'info' });
    return { queued:true, id:null };
  }

  // Derive card capability from AuthContext (profile.paymentMethods)
  const { profile } = useAuth();
  const hasCardCapability = Array.isArray(profile?.paymentMethods) ? profile.paymentMethods.includes('card') : false;
  const isDriver = profile?.role === 'driver';

  async function requestRideOrQueue(payload: RideRequestPayload): Promise<{ mode:'immediate'|'queued'; ride?: any; error?: any }> {
    if (!token) return { mode:'immediate', error:'not_authenticated' };
    // If offline or rate-limited, queue
    if (!navigator.onLine || rl.active) {
      handleEnqueueRideRequest(payload);
      return { mode:'queued' };
    }
    try {
      if (payload.paymentMethod && !['cash','card'].includes(payload.paymentMethod)) {
        return { mode:'immediate', error:{ error:'invalid_payment_method' } };
      }
      if (payload.paymentMethod === 'card' && !hasCardCapability) {
        return { mode:'immediate', error:{ error:'payment_method_required' } };
      }
      const ride = await api.rideRequest(token, payload);
      return { mode:'immediate', ride };
    } catch (error:any) {
      const cls = classifyError(error);
      if (cls.transient || cls.rateLimited) {
        handleEnqueueRideRequest(payload);
        return { mode:'queued' };
      }
      return { mode:'immediate', error };
    }
  }

  async function sendDriverLocationOrQueue(payload: DriverLocationPayload): Promise<{ mode:'immediate'|'queued'; error?: any }> {
    if (!token) return { mode:'immediate', error:'not_authenticated' };
    // Only drivers should send location updates; no-op for others
    if (!isDriver) return { mode:'immediate' };
    if (!navigator.onLine || rl.active) {
      enqueueDriverLocation(payload);
      setPending(size()); setItems(snapshotQueue());
      push({ message:t('queued_location_ping'), type:'info' });
      return { mode:'queued' };
    }
    try {
      await api.driverUpdateLocation(token, payload.lat, payload.lng);
      return { mode:'immediate' };
    } catch (error:any) {
      const cls = classifyError(error);
      if (cls.transient || cls.rateLimited) {
        const retryAfterMs = error?.retryAfterMs;
        const id = enqueueDriverLocation(payload);
        if (retryAfterMs && id) {
          // Annotate queue item with nextEligibleAt using snapshot adjustment and persist
          const snapshot = snapshotQueue();
          const target = snapshot.find(i=>i.id===id);
          if (target) {
            target.nextEligibleAt = Date.now() + retryAfterMs;
            try {
              // Force persistence by triggering a no-op process of queue snapshot into localStorage
              // (ActionQueue mutates in-memory; to persist we re-save via localStorage mirror)
              const raw = localStorage.getItem('action_queue_v1');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) {
                  const replaced = parsed.items.map((it:any)=> it.id===target.id ? { ...it, nextEligibleAt: target.nextEligibleAt } : it);
                  localStorage.setItem('action_queue_v1', JSON.stringify({ v:1, items: replaced }));
                }
              }
            } catch {}
          }
        }
        setPending(size()); setItems(snapshotQueue());
        push({ message:t('queued_location_ping'), type:'info' });
        return { mode:'queued' };
      }
      return { mode:'immediate', error };
    }
  }

  async function driverLifecycleOrQueue(payload: DriverLifecyclePayload): Promise<{ mode:'immediate'|'queued'; error?: any }> {
    if (!token) return { mode:'immediate', error:'not_authenticated' };
    if (!navigator.onLine || rl.active) {
      enqueueDriverLifecycle(payload);
      setPending(size()); setItems(snapshotQueue());
  push({ message: t(`lifecycle_${payload.op}_queued`, `Queued lifecycle ${payload.op}`), type:'info' });
      return { mode:'queued' };
    }
    try {
      if (payload.op==='arrive') await api.driverArrive(token, payload.rideId);
      else if (payload.op==='start') await api.driverStart(token, payload.rideId);
      else if (payload.op==='complete') await api.driverComplete(token, payload.rideId);
      return { mode:'immediate' };
    } catch (error:any) {
      const cls = classifyError(error);
      if (cls.transient || cls.rateLimited) {
        enqueueDriverLifecycle(payload);
        setPending(size()); setItems(snapshotQueue());
        push({ message: t(`lifecycle_${payload.op}_queued`, `Queued lifecycle ${payload.op}`), type:'info' });
        return { mode:'queued' };
      }
      if (error.code === 'immutable_state') {
        push({ message: t('lifecycle_immutable_state'), type:'info' });
      }
      return { mode:'immediate', error };
    }
  }

  return <Ctx.Provider value={{ enqueueFeedback: handleEnqueueFeedback, enqueueRideRequest: handleEnqueueRideRequest, requestRideOrQueue, sendDriverLocationOrQueue, driverLifecycleOrQueue, pending, processing, items, forceDrain: drain }}>{children}</Ctx.Provider>;
};

export function useMutationQueue() { return useContext(Ctx); }