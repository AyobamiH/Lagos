import { useCallback, useEffect, useState } from 'react';
import { connectSocket, getSocket } from '../realtime/socket';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useMutationQueue } from '../context/MutationQueueContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n/messages';

interface LifecycleState {
  rideId: string | null;
  status: string | null;
  accepting: boolean;
  error: string | null;
  accept: (rideId: string) => Promise<void>;
  decline: (rideId: string) => Promise<void>;
  arrive: () => Promise<void>;
  start: () => Promise<void>;
  complete: () => Promise<void>;
}

export function useDriverRideLifecycle(): LifecycleState {
  const { token } = useAuth();
  const { push } = useToast();
  const [rideId, setRideId] = useState<string|null>(null);
  const [status, setStatus] = useState<string|null>(null);
  const [accepting, setAccepting] = useState(false);
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const mq = useMutationQueue();
  const [error, setError] = useState<string|null>(null);

  // Wire socket for status updates
  useEffect(()=>{
    if (!token) return;
    if (!getSocket()) connectSocket(token);
    const s = getSocket();
    if (!s) return;
    function onStatus(st:any){ if (rideId && st.rideId === rideId) setStatus(st.status); }
    s.on('ride_status', onStatus);
    return ()=>{ s.off('ride_status', onStatus); };
  }, [token, rideId]);

  const accept = useCallback(async (rId: string) => {
    if (!token) return; setAccepting(true); setError(null);
  try { const res = await api.driverAcceptRide(token, rId); setRideId(rId); setStatus(res.status); push({ message:`${t('ride_accept_success')}: ${rId}`, type:'success' }); }
  catch(e:any){ const msg = e.friendlyMessage||e.error||t('ride_accept_failed'); setError(msg); push({ message:msg, type:'error' }); }
    setAccepting(false);
  }, [token, push]);

  const decline = useCallback(async (rId: string) => {
    if (!token) return; setAccepting(true); setError(null);
  try { await api.driverDeclineRide(token, rId); push({ message:`${t('ride_decline_success')}: ${rId}`, type:'info' }); }
  catch(e:any){ const msg = e.friendlyMessage||e.error||t('ride_decline_failed'); setError(msg); push({ message:msg, type:'error' }); }
    setAccepting(false);
  }, [token, push]);

  function opKey(op:string){ return rideId? `${rideId}:${op}`: op; }
  const execLifecycle = useCallback(async (op:'arrive'|'start'|'complete') => {
    if (!token || !rideId) return; const key = opKey(op); if (pendingOps.has(key)) return; setPendingOps(p=>new Set(p).add(key));
    try {
      const res = await mq.driverLifecycleOrQueue({ rideId, op });
      if (res.mode==='immediate' && !res.error) {
        // status updated by realtime eventually; we can optionally optimistic bump
        if (op==='arrive') setStatus('arrived_pickup');
        if (op==='start') setStatus('on_trip');
        if (op==='complete') setStatus('completed');
      } else if (res.mode==='queued') {
  push({ message: t(`lifecycle_${op}_queued`, `Lifecycle ${op} queued`), type:'info' });
      } else if (res.error) {
  push({ message: res.error.friendlyMessage || res.error.error || t(`lifecycle_${op}_failed`, `${op}_failed`), type:'error' });
      }
    } finally { setPendingOps(p=>{ const n=new Set(p); n.delete(key); return n; }); }
  }, [token, rideId, mq, pendingOps, push]);
  const arrive = useCallback(()=>execLifecycle('arrive'), [execLifecycle]);
  const start = useCallback(()=>execLifecycle('start'), [execLifecycle]);
  const complete = useCallback(()=>execLifecycle('complete'), [execLifecycle]);

  return { rideId, status, accepting, error, accept, decline, arrive, start, complete };
}
