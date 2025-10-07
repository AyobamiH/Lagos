import { useState, useCallback } from 'react';
import { parseLat, parseLng } from '../utils/validation';
import { useMutationQueue } from '../context/MutationQueueContext';
import { useAuth } from '../context/AuthContext';

export interface UseRideRequestState {
  loading: boolean;
  queued: boolean;
  error: string | null;
  ride: any | null;
  submit: (input: { pickupLat:string; pickupLng:string; dropLat:string; dropLng:string; productType:string; paymentMethod?:string }) => Promise<'queued'|'immediate'|'error'>;
  reset: () => void;
}

export function useRideRequest(): UseRideRequestState {
  const mq = useMutationQueue();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [ride, setRide] = useState<any|null>(null);

  const submit = useCallback(async ({ pickupLat, pickupLng, dropLat, dropLng, productType, paymentMethod }: { pickupLat:string; pickupLng:string; dropLat:string; dropLng:string; productType:string; paymentMethod?:string }) => {
    if (!token) { setError('not_authenticated'); return 'error'; }
    setLoading(true); setError(null); setRide(null); setQueued(false);
    try {
      const pLat = parseLat(pickupLat); const pLng = parseLng(pickupLng); const dLat = parseLat(dropLat); const dLng = parseLng(dropLng);
      if ([pLat,pLng,dLat,dLng].some(v=>v===null)) { setError('invalid_coordinates'); setLoading(false); return 'error'; }
      const payload = { pickup:{ lat:pLat!, lng:pLng! }, dropoff:{ lat:dLat!, lng:dLng! }, productType, ...(paymentMethod? { paymentMethod } : {}) } as any;
      const res = await mq.requestRideOrQueue(payload);
      if (res.mode === 'queued') { setQueued(true); return 'queued'; }
      if (res.ride) { setRide(res.ride); return 'immediate'; }
      if (res.error) { setError(res.error.error || res.error.message || 'request_failed'); return 'error'; }
      return 'error';
    } catch (e:any) {
      setError(e?.error || 'request_failed');
      return 'error';
    } finally { setLoading(false); }
  }, [mq, token]);

  function reset() { setError(null); setRide(null); setQueued(false); }

  return { loading, queued, error, ride, submit, reset };
}
