import { useEffect, useRef, useState, useCallback } from 'react';
import { Ride } from '../types/domain';
import { fetchWithETag, etagCache } from '../utils/etagCache';

export function useRide(rideId: string | null) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const etagKey = `ride:${rideId}`;
  const socketRef = useRef<any>();

  const load = useCallback(async () => {
    if (!rideId) return;
    setLoading(true);
    try {
      const data = await fetchWithETag<{ ride: Ride }>(etagKey, `/api/v1/rides/${rideId}`);
      // Accept either {ride} or legacy direct ride shape
      const r: any = (data as any).ride || data;
      setRide(r);
    } finally { setLoading(false); }
  }, [rideId]);

  const patchRide = useCallback(async (patch: Partial<Ride>) => {
    if (!rideId) return;
    const cached = etagCache.get<any>(etagKey);
    const headers: Record<string,string> = { 'Content-Type':'application/json' };
    if (cached?.etag) headers['If-Match'] = cached.etag;
    const res = await fetch(`/api/v1/rides/${rideId}`, { method: 'PATCH', headers, body: JSON.stringify(patch) });
    if (res.status === 412 || res.status === 409) {
      await load();
      throw new Error('concurrent_update');
    }
    const json = await res.json();
    setRide(r => ({ ...(r||{}), ...json }));
  }, [rideId, load]);

  useEffect(() => { load(); }, [load]);

  // Placeholder realtime integration hook-in
  useEffect(() => {
    // In future: subscribe to socket.io events ride.<id>.update
    return () => { /* unsubscribe */ };
  }, [rideId]);

  return { ride, loading, reload: load, patchRide };
}
