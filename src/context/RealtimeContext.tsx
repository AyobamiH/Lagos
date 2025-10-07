import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { connectSocket, getSocket, disconnectSocket, wasRecentlyTried } from '../realtime/socket';
import { useToast } from './ToastContext';
import { api } from '../api/client';
import { RideStatusEventSchema, DriverPositionEventSchema } from '../api/schemas';
import { t } from '../i18n/messages';

interface RideStatusUpdate {
  rideId: string;
  status: string;
  driverId?: string;
  finalFare?: number;
  timestamps?: any;
  seq?: number;
}

interface DriverOffer { rideId:string; fare:number; productType?:string; createdAt:string; seq?:number }
interface RealtimeState {
  lastUpdates: Record<string, RideStatusUpdate>;
  allOrdered: RideStatusUpdate[]; // most recent first
  reconnect: () => void;
  connected: boolean;
  offers: DriverOffer[];
  clearOffer: (rideId:string) => void;
  lastDriverPositions?: Record<string, { lat:number; lng:number; heading?:number; ts:number; driverId?:string }>;
  lastSos?: { rideId:string; riderId?:string; lat?:number; lng?:number; at:number } | null;
  clearLastSos: () => void;
}

const Ctx = createContext<RealtimeState>(null as any);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, profile } = useAuth();
  const [lastUpdates, setLastUpdates] = useState<Record<string, RideStatusUpdate>>({});
  const [allOrdered, setAllOrdered] = useState<RideStatusUpdate[]>([]);
  const [connected, setConnected] = useState(false);
  const { push } = useToast();
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [lastSeq, setLastSeq] = useState<number>(0);
  const [lastDriverPositions, setLastDriverPositions] = useState<Record<string, { lat:number; lng:number; heading?:number; ts:number; driverId?:string }>>({});
  const [lastSos, setLastSos] = useState<{ rideId:string; riderId?:string; lat?:number; lng?:number; at:number } | null>(null);
  const GAP_THRESHOLD = 1; // any jump >1 triggers warning

  useEffect(() => {
    // Helper to schedule state updates in a microtask so tests can await naturally and reduce act warnings
    const safeSet = (fn: () => void) => { Promise.resolve().then(fn); };
    if (!token) {
      disconnectSocket();
      setLastUpdates({});
      setAllOrdered([]);
      return;
    }
    if (!getSocket()) {
      const s = connectSocket(token);
  s.on('connect', () => { safeSet(()=>setConnected(true)); push({ message:t('realtime_connected'), type:'success', ttl:3000 }); });
  s.on('disconnect', () => { safeSet(()=>setConnected(false)); push({ message:t('realtime_disconnected'), type:'error', ttl:6000 }); });
  s.on('ride_status', (raw: any) => {
        const parsed = RideStatusEventSchema.safeParse(raw);
        if (!parsed.success) {
          push({ message:t('invalid_ride_status_event'), type:'error', ttl:4000 });
          return;
        }
        const payload = {
          rideId: parsed.data.rideId,
            status: parsed.data.status || (raw as any).status || 'unknown',
            seq: parsed.data.seq || (raw as any).seq || 0,
            emittedAt: parsed.data.emittedAt || Date.now()
        } as RideStatusUpdate;
        if (payload.seq) {
          if (payload.seq <= lastSeq) return; // stale/out-of-order
          if (lastSeq && payload.seq - lastSeq > GAP_THRESHOLD) {
            const missed = payload.seq - lastSeq - 1;
            push({ message:`${t('realtime_gap_detected')} (missed ${missed} events)`, type:'error', ttl:7000 });
            (async () => {
              try {
                if (!token) return;
                const page = await api.ridesPage(token, null);
                if (page?.rides) {
                  page.rides.forEach(r => {
                    setLastUpdates(prev => ({ ...prev, [r._id]: { rideId: r._id, status: r.status } }));
                  });
                }
              } catch {/* ignore repair errors */}
            })();
          }
          setLastSeq(payload.seq);
        }
        safeSet(()=>{
          setLastUpdates(prev => ({ ...prev, [payload.rideId]: payload }));
          setAllOrdered(prev => [payload, ...prev].slice(0, 200));
        });
      });
      // Offers event (driver assignment queue) - placeholder channel name 'offer'
      s.on('offer', (raw:any) => {
        try {
          const offer: DriverOffer = { rideId: raw.rideId, fare: raw.fare||0, productType: raw.productType, createdAt: raw.createdAt || new Date().toISOString(), seq: raw.seq };
          setOffers(prev => [offer, ...prev.filter(o=>o.rideId!==offer.rideId)].slice(0,100));
          push({ message:`New offer ${offer.rideId}`, type:'info', ttl:4000 });
        } catch { /* ignore */ }
      });
      // Driver position stream for active ride (to rider)
      s.on('driver_position', (raw:any) => {
        const parsed = DriverPositionEventSchema.safeParse(raw);
        if (!parsed.success) return;
        const p = parsed.data;
        setLastDriverPositions(prev => ({ ...prev, [p.rideId]: { lat: p.lat, lng: p.lng, heading: p.heading, ts: p.ts || Date.now(), driverId: p.driverId } }));
      });
      // SOS alerts to drivers
      if (profile?.role === 'driver') {
        s.on('sos', (raw:any) => {
          try {
            const payload = {
              rideId: String(raw?.rideId || ''),
              riderId: raw?.riderId ? String(raw.riderId) : undefined,
              lat: typeof raw?.lat === 'number' ? raw.lat : undefined,
              lng: typeof raw?.lng === 'number' ? raw.lng : undefined,
              at: Number(raw?.at || Date.now())
            } as { rideId:string; riderId?:string; lat?:number; lng?:number; at:number };
            setLastSos(payload);
            push({ message: `SOS from rider${payload.rideId ? ` • ride ${payload.rideId}`:''}`, type:'error', ttl:8000 });
          } catch { /* ignore parse errors */ }
        });
      }
    } else {
      setConnected(true);
    }
    const poll = setInterval(async () => {
      if (getSocket()) return;
      if (wasRecentlyTried()) return;
      try {
        if (!token) return;
        if (profile?.role === 'driver') return; // driver doesn't need rider rides polling
        const page = await api.ridesPage(token, null);
        if (page?.rides) page.rides.forEach(r => setLastUpdates(prev => ({ ...prev, [r._id]: { rideId:r._id, status:r.status } })));
      } catch {/* ignore */}
    }, 8000);
    return () => clearInterval(poll);
  }, [token]);

  // Re-authenticate socket if token changes while a socket exists
  useEffect(() => {
    const s = getSocket();
    if (s && token) {
      try { s.emit('auth:update', { token }); } catch {}
    }
  }, [token]);

  function reconnect() {
    if (!token) return;
    try { disconnectSocket(); } catch (e) { /* swallow */ }
    connectSocket(token);
  }
  function clearOffer(id:string) { setOffers(o => o.filter(of=>of.rideId!==id)); }
  function clearLastSos() { setLastSos(null); }
  return <Ctx.Provider value={{ lastUpdates, allOrdered, reconnect, connected, offers, clearOffer, lastDriverPositions, lastSos, clearLastSos }}>{children}</Ctx.Provider>;
};

export const useRealtime = () => useContext(Ctx);
export type { RealtimeState };
