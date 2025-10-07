import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../realtime/socket';
import { api, request } from '../../api/client';
import { parseLat, parseLng } from '../../utils/validation';
import { useMutationQueue } from '../../context/MutationQueueContext';
import { OfferSchema } from '../../api/schemas';
import { useFeatureFlags } from '../../context/FeatureFlagsContext';
import { useToast } from '../../context/ToastContext';
import { useDriverRideLifecycle } from '../../hooks/useDriverRideLifecycle';
import { useRealtime } from '../../context/RealtimeContext';
import { formatCurrencyNGN } from '../../utils/format';

interface Offer { rideId: string; fare?: number; eta?: number; status?: string; createdAt: number; pickup?: [number, number]; expiresAt?: string; }

function ExpireCountdown({ ts }: { ts: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = useMemo(() => {
    const t = Date.parse(ts);
    return Number.isNaN(t) ? null : t;
  }, [ts]);
  if (!end) return <span>—</span>;
  const diff = Math.max(0, Math.floor((end - now) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return <span>{m}:{s.toString().padStart(2, '0')}</span>;
}

export default function DriverPanel() {
  const { token, profile } = useAuth();
  const { push } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);
  const [offerMeta, setOfferMeta] = useState<{ dropoff?: { lat:number, lng:number }, dropoffLabel?: string } | null>(null);
  const lifecycle = useDriverRideLifecycle();
  const { lastSos, clearLastSos } = useRealtime();
  const [loc, setLoc] = useState({ lat:'6.5244', lng:'3.3792' });
  const [locBusy, setLocBusy] = useState(false);
  const [liveLocOn, setLiveLocOn] = useState(false);
  const geoWatchId = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const [availability, setAvailability] = useState<{ total:number; available:number; busy:number }|null>(null);
  const [toggling, setToggling] = useState(false);
  const { isEnabled } = useFeatureFlags();
  const [selfAvailable, setSelfAvailable] = useState<boolean>(true); // Track local driver availability state
  const mq = useMutationQueue();
  const queuedLocationPings = mq.items?.filter(i => i.kind === 'driver_location_ping').length || 0;
  // Earnings & online session tracking
  const [completedToday, setCompletedToday] = useState<number>(0);
  const [earningsToday, setEarningsToday] = useState<number>(0);
  const [onlineStart, setOnlineStart] = useState<number | null>(null);
  const [onlineAccumMs, setOnlineAccumMs] = useState<number>(0);
  const onlineTicker = useRef<number | null>(null);
  const [surgeLayers, setSurgeLayers] = useState<any[] | null>(null);
  const [offerSoundOn, setOfferSoundOn] = useState<boolean>(() => {
    try { const v = localStorage.getItem('offer_sound_on'); return v === null ? true : v === '1'; } catch { return true; }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showOnlineTip, setShowOnlineTip] = useState<boolean>(() => {
    try { return localStorage.getItem('driver_tip_online_seen') !== '1'; } catch { return true; }
  });
  const [driverView, setDriverView] = useState<any | null>(null);

  async function loadAvailability() {
    if (!token) return;
    try {
      try {
        const snapshot = await api.availability(token);
        setAvailability(snapshot);
      } catch { /* swallow */ }
      try {
        const me = await api.driverMe(token);
        const isAvail = !!(me?.driver?.isAvailable ?? true);
        setSelfAvailable(isAvail);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!token) return;
    if (!getSocket()) connectSocket(token);
    const s = getSocket();
    if (!s) return;
    function onOffer(payload: any) {
      const parsed = OfferSchema.safeParse({ ...payload, createdAt: Date.now(), status: 'offer_pending' });
      if (!parsed.success) { push({ message:'Ignored invalid offer payload', type:'error' }); return; }
      const offer = { ...(parsed.data as any), pickup: Array.isArray(payload?.pickup) ? payload.pickup : undefined, expiresAt: payload?.expiresAt, eta: (payload?.etaToPickup ?? (parsed as any)?.eta) } as Offer & { surgeMultiplier?: number };
      setOffers(o => [offer, ...o.filter(x=>x.rideId!==offer.rideId)].slice(0,50));
      push({ message:`Offer ${offer.rideId}`, type:'info' });
      // Pop immersive offer modal for decisive moment
      setActiveOffer(offer);
      // Fetch dropoff details for the offer (driver-view emulation via ride details)
      fetchOfferMeta(offer.rideId).catch(()=>{});
      try { if (offerSoundOn) { if (!audioRef.current) initOfferAudio(); audioRef.current!.play().catch(()=>{}); } } catch (e) { void 0; }
    }
    function onStatus(st: any) {
      // Record completions to update today summary
      try {
        if (st?.status === 'completed') {
          setCompletedToday(n => n + 1);
          if (typeof st.finalFare === 'number') setEarningsToday(v => v + st.finalFare);
          else if (typeof st.fare === 'number') setEarningsToday(v => v + st.fare);
          const earned = typeof st.finalFare === 'number' ? st.finalFare : (typeof st.fare === 'number' ? st.fare : 0);
          push({ message: `Trip Complete • Earnings: ${formatCurrencyNGN(earned)}`, type: 'success' });
        }
      } catch (e) { void 0; }
    }
    s.on('ride_request', onOffer);
    s.on('ride_status', onStatus);
    loadAvailability();
    (async()=>{
      try {
        const v = await request(`/surge/versions`, { headers: { Authorization: `Bearer ${token}` } });
        const versions = Array.isArray(v) ? v : (Array.isArray(v?.items) ? v.items : []);
        const latest = versions.find((x:any)=>x.active) || versions[0];
        if (latest && latest.grid) {
          const feats = latest.grid.features || latest.grid;
          if (Array.isArray(feats)) setSurgeLayers(feats);
        }
      } catch (e) { void 0; }
    })();
    return () => { s.off('ride_request', onOffer); s.off('ride_status', onStatus); };
  }, [token, lifecycle.rideId]);

  async function fetchOfferMeta(rideId: string) {
    if (!token) return;
    try {
      let d: any = null;
      try { d = await request(`/rides/${rideId}/driver-view`, { headers: { Authorization: `Bearer ${token}` } }); }
  catch { d = await request(`/rides/${rideId}`, { headers: { Authorization: `Bearer ${token}` } }); }
      const drop = d?.dropoff?.coordinates;
      if (Array.isArray(drop) && drop.length === 2) {
        const meta: any = { dropoff: { lng: drop[0], lat: drop[1] } };
        setOfferMeta(meta);
        // Attempt a best-effort reverse geocode via backend proxy if available
        try {
          const q = new URLSearchParams({ lat: String(meta.dropoff.lat), lng: String(meta.dropoff.lng) }).toString();
          const g = await request(`/geocode/reverse?${q}`, { headers: { Authorization: `Bearer ${token}` } });
          const label = g?.displayName || g?.display_name || g?.name || null;
          if (label) setOfferMeta((m:any)=> ({ ...(m||{}), dropoffLabel: label }));
        } catch (e) { void 0; /* optional */ }
      }
    } catch (e) { void 0; /* ignore */ }
  }

  async function toggleAvailability() {
    if (!profile || profile.role !== 'driver') return;
    setToggling(true);
    try {
      // Attempt backend toggle first; fallback to local simulation on failure.
      const target = !selfAvailable;
      try {
        const res = await request(`/drivers/availability`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ available: target }) });
        if (res) {
          setSelfAvailable(target);
          // Online session tracking
          if (target) {
            setOnlineStart(Date.now());
            if (!onlineTicker.current) onlineTicker.current = window.setInterval(()=>{ setOnlineAccumMs(ms=>ms); }, 1000);
          } else {
            setOnlineAccumMs(ms => ms + (onlineStart ? Date.now() - onlineStart : 0));
            setOnlineStart(null);
            if (onlineTicker.current) { clearInterval(onlineTicker.current); onlineTicker.current = null; }
          }
          loadAvailability();
          push({ message:`You are now ${target? 'available':'unavailable'}`, type:'success' });
          return;
        }
      } catch (e) { void 0; /* ignore network, fallback below */ }
      // Fallback local simulation
      setSelfAvailable(target);
      if (target) {
        setOnlineStart(Date.now());
        if (!onlineTicker.current) onlineTicker.current = window.setInterval(()=>{ setOnlineAccumMs(ms=>ms); }, 1000);
      } else {
        setOnlineAccumMs(ms => ms + (onlineStart ? Date.now() - onlineStart : 0));
        setOnlineStart(null);
        if (onlineTicker.current) { clearInterval(onlineTicker.current); onlineTicker.current = null; }
      }
      setAvailability(a => a ? { ...a, available: Math.max(0, a.available + (target?1:-1)), busy: Math.max(0, a.busy + (target?-1:1)) } : a);
      push({ message:`(Simulated) now ${target? 'available':'unavailable'}`, type:'info' });
    } finally { setToggling(false); }
  }

  async function respond(rideId: string, accept: boolean) {
    if (accept) await lifecycle.accept(rideId); else await lifecycle.decline(rideId);
    setOffers(o => o.map(of => of.rideId === rideId ? { ...of, status: accept? 'accepted':'declined' } : of));
  }

  async function updateLocation() {
    if (!token) return; const latNum = parseLat(loc.lat); const lngNum = parseLng(loc.lng); if (latNum===null||lngNum===null) { push({ message:'invalid_coords', type:'error' }); return; }
    setLocBusy(true);
    const res = await mq.sendDriverLocationOrQueue({ lat: latNum, lng: lngNum });
    if (res.mode === 'immediate' && !res.error) push({ message:'Location ping sent', type:'info' });
    if (res.error) push({ message: res.error.friendlyMessage || res.error.error || 'loc_failed', type:'error' });
    setLocBusy(false);
  }

  function stopLiveLocation() {
    try { if (geoWatchId.current !== null && navigator.geolocation?.clearWatch) navigator.geolocation.clearWatch(geoWatchId.current); } catch (e) { void 0; }
    geoWatchId.current = null; setLiveLocOn(false);
  }

  async function startLiveLocation() {
    if (!token) { push({ message:'login_required', type:'error' }); return; }
    if (!profile || profile.role !== 'driver') { push({ message:'driver_role_required', type:'error' }); return; }
    if (!('geolocation' in navigator)) { push({ message:'Geolocation not supported on this device', type:'error' }); return; }
    // Optional: preflight permissions (best-effort)
    try {
      // @ts-ignore - permissions API may not exist on all browsers
      const perm = await (navigator.permissions?.query?.({ name: 'geolocation' as any }) || Promise.resolve(null));
      // If explicitly denied, abort early
      // @ts-ignore
      if (perm && perm.state === 'denied') { push({ message:'Location permission denied', type:'error' }); return; }
    } catch (e) { void 0; }
    // Begin watching with high accuracy. Backend limit ~2 req/sec, so throttle client.
    const minIntervalMs = 1500;
    try {
      const id = navigator.geolocation.watchPosition(async (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < minIntervalMs) return;
        lastSentRef.current = now;
        const { latitude, longitude, heading, speed, accuracy } = pos.coords || {} as any;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
        const payload: any = { lat: latitude, lng: longitude };
        if (typeof heading === 'number' && !Number.isNaN(heading)) payload.heading = heading;
        if (typeof speed === 'number' && !Number.isNaN(speed)) payload.speed = speed;
        if (typeof accuracy === 'number' && !Number.isNaN(accuracy)) payload.accuracy = accuracy;
        payload.timestamp = pos.timestamp || Date.now();
        const res = await mq.sendDriverLocationOrQueue(payload);
        if (res.error) push({ message: res.error.friendlyMessage || res.error.error || 'loc_failed', type:'error' });
      }, (err) => {
        push({ message: err?.message || 'Location watch error', type:'error' });
        stopLiveLocation();
      }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
      // Some environments return number, some return any
      geoWatchId.current = (id as unknown as number) ?? null;
      setLiveLocOn(true);
      push({ message:'Live location started', type:'success' });
    } catch (e: any) {
      push({ message: e?.message || 'Unable to start live location', type:'error' });
      stopLiveLocation();
    }
  }

  // Auto-start/stop live location tracking when ride state changes
  useEffect(() => {
    if (profile?.role==='driver' && lifecycle.rideId && !liveLocOn) {
      // Fire and forget; if permission denied, a toast will show and tracking won't start
      startLiveLocation();
    }
    if ((!lifecycle.rideId || profile?.role!=='driver') && liveLocOn) {
      stopLiveLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle.rideId, profile?.role]);

  async function doAction(kind:'arrive'|'start'|'complete') {
    if (!lifecycle.rideId) return;
    try {
      if (kind==='arrive') await lifecycle.arrive();
      else if (kind==='start') await lifecycle.start();
      else await lifecycle.complete();
    } catch { /* hook already toasts */ }
  }

  const earningsNow = useMemo(()=>{
    // Prefer active lifecycle last known fare else offer estimate sum (first offer shown)
    const active = offers.find(o=>o.rideId===lifecycle.rideId);
    return active?.fare ?? null;
  }, [offers, lifecycle.rideId]);

  if (!profile) return <p>Login as a driver to view offers.</p>;
  if (profile && profile.role !== 'driver') return <p>Access restricted: driver role required.</p>;

  const onlineMs = (onlineStart ? (Date.now() - onlineStart) : 0) + onlineAccumMs;
  const onlineH = Math.floor(onlineMs / 3600000);
  const onlineM = Math.floor((onlineMs % 3600000) / 60000);

  const onlineChip = (
    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${selfAvailable? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30':'bg-slate-700 text-slate-200 border border-slate-600'}`}>
      {selfAvailable? 'Online':'Offline'}
    </span>
  );

  function initOfferAudio() {
    const SRC = 'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAChAAAAAAAAPwAAAP///wAAAP///wAAAP///wAAAP8AAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8A';
    const a = new Audio(SRC);
    a.volume = 0.4;
    audioRef.current = a;
  }

  function OnlineTip() {
    if (!showOnlineTip || selfAvailable) return null;
    return (
      <div className="absolute z-40 mt-14 right-4 bg-slate-800 text-slate-100 border border-slate-600 rounded-xl p-3 shadow-xl w-64">
        <div className="text-sm font-semibold">Go Online</div>
        <div className="text-xs opacity-80 mt-1">Tap here to go Online and start receiving trip requests. We&rsquo;ll stream your location to match you with nearby riders.</div>
        <div className="mt-2 flex justify-end">
          <button className="text-xs underline" onClick={()=>{ setShowOnlineTip(false); try{ localStorage.setItem('driver_tip_online_seen','1'); }catch{} }}>Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 grid gap-4 bg-slate-900 text-slate-100 min-h-[calc(100vh-4rem)]">
      {/* KYC Banner */}
      {profile?.role==='driver' && profile?.kycStatus !== 'approved' && (
        <div className="rounded-xl bg-amber-500/20 border border-amber-500 text-amber-100 p-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">Action required: Complete KYC to start earning</div>
            <div className="text-sm opacity-90">Your account is inactive until KYC is approved.</div>
          </div>
          <Link to="/driver/kyc" className="ml-3 text-xs underline text-amber-100">Open KYC</Link>
        </div>
      )}
      <header className="relative flex items-center justify-between">
        <h2 className="text-xl font-semibold">Driver {onlineChip}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAvailability}
            disabled={toggling || !!lifecycle.rideId}
            title={lifecycle.rideId ? 'Go Offline after current trip' : ''}
            className={`h-12 px-5 rounded-2xl font-bold min-w-[120px] ${selfAvailable? 'bg-emerald-500 hover:bg-emerald-600 text-slate-900':'bg-slate-700 hover:bg-slate-600 text-slate-100'} disabled:opacity-50 ${toggling? 'animate-pulse':''}`}
          >
            {toggling? 'Updating…' : (selfAvailable? 'Online':'Offline')}
          </button>
          <button onClick={() => liveLocOn ? stopLiveLocation() : startLiveLocation()} className={`h-12 px-5 rounded-xl font-semibold ${liveLocOn? 'bg-sky-500 hover:bg-sky-600':'bg-slate-700 hover:bg-slate-600'}`}>
            {liveLocOn ? 'Stop live location' : 'Start live location'}
          </button>
          {/* Avatar/initials */}
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold border border-slate-600" title={profile?.name || ''}>
            {(profile?.name||'D').slice(0,1).toUpperCase()}
          </div>
        </div>
        <OnlineTip />
      </header>
      {/* Map & surge overlay */}
      <section className="rounded-xl overflow-hidden border border-slate-700">
        <div style={{height: 260}}>
          <MapContainer center={[parseFloat(loc.lat)||6.5244, parseFloat(loc.lng)||3.3792]} zoom={13} scrollWheelZoom={false} style={{height:'100%', width:'100%'}}>
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />
            <Marker position={[parseFloat(loc.lat)||6.5244, parseFloat(loc.lng)||3.3792]} icon={L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconSize: [25,41], iconAnchor:[12,41], shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })}>
              <Popup>Your location</Popup>
            </Marker>
            {Array.isArray(surgeLayers) && surgeLayers.length>0 && (
              <GeoJSON data={{ type:'FeatureCollection', features: surgeLayers as any }} style={(feat:any)=>{
                const m = feat?.properties?.multiplier ?? feat?.properties?.surge ?? 1;
                const color = m >= 2 ? '#ef4444' : m >= 1.5 ? '#f59e0b' : m > 1 ? '#fde68a' : '#374151';
                return { color, weight: 1, fillColor: color, fillOpacity: m > 1 ? 0.25 : 0.08 };
              }} />
            )}
          </MapContainer>
        </div>
      </section>
      {lastSos && (
        <div className="rounded-xl bg-red-600/20 border border-red-600 text-red-100 p-3 flex items-start justify-between">
          <div>
            <div className="font-semibold">SOS received</div>
            <div className="text-sm opacity-90">{lastSos.rideId ? `Ride ${lastSos.rideId}` : 'Active ride'}</div>
            {(typeof lastSos.lat==='number' && typeof lastSos.lng==='number') && (
              <div className="text-xs opacity-80">
                Last known: {lastSos.lat.toFixed(5)}, {lastSos.lng.toFixed(5)}
                {' '}
                <a
                  className="underline ml-1"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps?q=${lastSos.lat},${lastSos.lng}`}
                >Open in Maps</a>
              </div>
            )}
          </div>
          <button onClick={clearLastSos} className="ml-3 text-xs underline">Dismiss</button>
        </div>
      )}
      {availability && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-slate-800">Total: <span className="font-bold">{availability.total}</span></div>
          <div className="p-3 rounded-lg bg-slate-800">Available: <span className="font-bold text-emerald-400">{availability.available}</span></div>
          <div className="p-3 rounded-lg bg-slate-800">Busy: <span className="font-bold text-amber-400">{availability.busy}</span></div>
        </div>
      )}
      <section>
        <h3 className="mb-2 font-medium">Offers</h3>
        <ul className="grid gap-3">
          {offers.map(of => (
            <li key={of.rideId} className="rounded-xl bg-slate-800 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">{of.rideId}</div>
                <div className="text-sm">Fare: <span className="font-semibold">{typeof of.fare==='number'? formatCurrencyNGN(of.fare): '—'}</span> • ETA to pickup: {of.eta ?? '—'}m {typeof (of as any).surgeMultiplier === 'number' && <span className="ml-1 text-amber-300">surge x{(of as any).surgeMultiplier}</span>}</div>
                {Array.isArray(of.pickup) && of.pickup.length===2 && (
                  <div className="text-[11px] text-slate-400">Pickup: {of.pickup[1].toFixed(5)}, {of.pickup[0].toFixed(5)}{' '}
                    <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${of.pickup[1]},${of.pickup[0]}`}>Open in Maps</a>
                  </div>
                )}
                {of.expiresAt && (
                  <div className="text-[11px] text-amber-300">Expires in <ExpireCountdown ts={of.expiresAt} /></div>
                )}
                <div className="text-[11px] text-slate-400">{of.status}</div>
              </div>
              <div className="flex gap-2">
                <button disabled={!!lifecycle.rideId || lifecycle.accepting} onClick={()=>{ setActiveOffer(of); fetchOfferMeta(of.rideId).catch(()=>{}); }} className="h-12 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold disabled:opacity-50">VIEW</button>
                <button disabled={!!lifecycle.rideId || lifecycle.accepting} onClick={()=>respond(of.rideId,false)} className="h-12 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold disabled:opacity-50">DECLINE</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {/* Earnings summary (glanceable) */}
      <section className="sticky bottom-16 md:static grid grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-slate-800">
          Trips Today: <span className="font-bold text-emerald-400">{completedToday}</span>
        </div>
        <div className="p-3 rounded-lg bg-slate-800">
          Earnings: <span className="font-bold">{formatCurrencyNGN(earningsToday || 0)}</span>
        </div>
        <div className="p-3 rounded-lg bg-slate-800">
          Online: <span className="font-bold">{onlineH}h {onlineM}m</span>
        </div>
      </section>
      {lifecycle.rideId && (
        <section className="grid gap-3 rounded-xl bg-slate-800 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium m-0">Active Ride</h3>
            {earningsNow !== null && <div className="text-sm">Earnings: <span className="font-semibold">{formatCurrencyNGN(earningsNow || 0)}</span></div>}
          </div>
          {queuedLocationPings > 0 && <div className="text-xs text-amber-300">Queued location pings: {queuedLocationPings}</div>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>doAction('arrive')} disabled={['arrived_pickup','on_trip','completed'].includes(lifecycle.status||'')} className="h-12 px-5 rounded-lg bg-sky-500 hover:bg-sky-600 text-slate-900 font-bold disabled:opacity-40">ARRIVE</button>
            <button onClick={()=>doAction('start')} disabled={!(lifecycle.status==='arrived_pickup') || ['on_trip','completed'].includes(lifecycle.status||'')} className="h-12 px-5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold disabled:opacity-40">START</button>
            <button onClick={()=>doAction('complete')} disabled={lifecycle.status!=='on_trip'} className="h-12 px-5 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-slate-900 font-bold disabled:opacity-40">COMPLETE</button>
          </div>
          {!liveLocOn && (
            <div className="text-xs text-slate-300">Tip: Enable &quot;Start live location&quot; above to stream your GPS to the rider in real-time.</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Lat
              <input className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm" value={loc.lat} onChange={e=>setLoc(l=>({...l,lat:e.target.value}))} />
            </label>
            <label className="text-xs">Lng
              <input className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm" value={loc.lng} onChange={e=>setLoc(l=>({...l,lng:e.target.value}))} />
            </label>
          </div>
          <button disabled={locBusy} onClick={updateLocation} className="h-12 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold">{locBusy? 'Pinging…' : 'Send Location Ping'}</button>
        </section>
      )}

      {/* Offer Overlay Modal */}
      {activeOffer && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl animate-[slide-up_200ms_ease-out]">
            <div className="text-xs text-slate-400">Offer • {activeOffer.rideId}</div>
            <div className="mt-2 text-2xl font-extrabold text-white">{typeof activeOffer.fare==='number'? formatCurrencyNGN(activeOffer.fare): '—'}</div>
            <div className="mt-1 text-sm text-slate-300">ETA to pickup: {activeOffer.eta ?? '—'} mins</div>
            {Array.isArray(activeOffer.pickup) && (
              <div className="text-xs text-slate-400 mt-1">Pickup: {activeOffer.pickup[1].toFixed(5)}, {activeOffer.pickup[0].toFixed(5)}</div>
            )}
            {offerMeta?.dropoff && (
              <div className="text-xs text-slate-400 mt-1">Dropoff: {offerMeta.dropoffLabel || `${offerMeta.dropoff.lat.toFixed(5)}, ${offerMeta.dropoff.lng.toFixed(5)}`}</div>
            )}
            {activeOffer.expiresAt && (
              <div className="mt-3 text-sm text-amber-300">Time left: <span className="text-lg font-bold"><ExpireCountdown ts={activeOffer.expiresAt} /></span></div>
            )}
            <div className="mt-4 grid gap-2">
              <button
                onClick={async()=>{ await respond(activeOffer.rideId, true); setActiveOffer(null); }}
                className="min-h-16 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 text-lg font-extrabold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 animate-pulse"
                disabled={!!lifecycle.rideId || lifecycle.accepting}
              >ACCEPT RIDE</button>
              <div className="flex items-center justify-between">
                <button onClick={()=>setActiveOffer(null)} className="text-xs text-slate-400 underline mt-1">Close</button>
                <button
                  onClick={async()=>{ await respond(activeOffer.rideId, false); setActiveOffer(null); }}
                  className="h-10 px-4 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800"
                  disabled={!!lifecycle.rideId || lifecycle.accepting}
                >Decline</button>
              </div>
              <div className="flex items-center justify-end gap-2 mt-1 text-xs text-slate-400">
                <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" checked={offerSoundOn} onChange={(e)=>{ setOfferSoundOn(e.target.checked); try{ localStorage.setItem('offer_sound_on', e.target.checked?'1':'0'); }catch{} }} />
                  Sound on offer
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
