import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { parseLat, parseLng } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { useMutationQueue } from '../../context/MutationQueueContext';
import { useRideRequest } from '../../hooks/useRideRequest';
import { getSocket, connectSocket } from '../../realtime/socket';
import { SosButton } from '../../components/SosButton';
import { api } from '../../api/client';
import { Link } from 'react-router-dom';
const MapPicker = lazy(()=>import('../../components/MapPicker').then(m=>({ default: m.MapPicker })));

function friendlyStatus(s?: string) {
  if (!s) return '';
  if (s.includes('match')) return 'Matching…';
  if (s.includes('driver_en_route') || s.includes('assigned') || s.includes('matched')) return 'Driver arriving…';
  if (s.includes('pickup_arrived')) return 'Driver has arrived';
  if (s.includes('in_progress') || s.includes('on_trip')) return 'On trip';
  if (s.includes('completed')) return 'Completed';
  if (s.includes('cancel')) return 'Cancelled';
  return s.replaceAll('_',' ');
}

export default function RequestRide() {
  const { token, profile } = useAuth();
  const [pickupLat, setPickupLat] = useState('6.5244');
  const [pickupLng, setPickupLng] = useState('3.3792');
  const [dropLat, setDropLat] = useState('6.4500');
  const [dropLng, setDropLng] = useState('3.4000');
  const [productType, setProductType] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [response, setResponse] = useState<any|null>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number|null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const mq = useMutationQueue();
  const rideReq = useRideRequest();
  const [quote, setQuote] = useState<{ fare?: number; currency?: string; eta?: number }|null>(null);
  const [quoting, setQuoting] = useState(false);
  const hasCardCapability = Array.isArray(profile?.paymentMethods) ? profile!.paymentMethods!.includes('card') : false;
  function kmDistance(aLat:number, aLng:number, bLat:number, bLng:number) {
    const R = 6371; const toRad=(d:number)=>d*Math.PI/180;
    const dLat = toRad(bLat-aLat); const dLng=toRad(bLng-aLng);
    const aa = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
    const c = 2*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa)); return R*c;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError('not_authenticated'); return; }
    setLoading(true); setError(null); setResponse(null); setLatencyMs(null);
    const start = performance.now();
    try {
  const allowedPayment = ['cash','card'];
  if (!allowedPayment.includes(paymentMethod)) { setError('invalid_payment_method'); setLoading(false); return; }
  const mode = await rideReq.submit({ pickupLat, pickupLng, dropLat, dropLng, productType, paymentMethod });
      if (mode === 'immediate' && rideReq.ride) setResponse(rideReq.ride);
      // Establish socket once after first ride request (if not already)
      if (token && !getSocket()) {
        const s = connectSocket(token);
        s.on('ride_status', (st) => {
          setStatuses(prev => [st, ...prev].slice(0, 50));
        });
      }
    } catch (e:any) {
      setError(e.error || 'request_failed');
    } finally {
      setLoading(false);
      setLatencyMs(Math.round(performance.now() - start));
    }
  }

  async function submitDirect() {
    if (!token) { setError('not_authenticated'); return; }
    setLoading(true); setError(null); setResponse(null); setLatencyMs(null);
    const start = performance.now();
    try {
      const allowedPayment = ['cash','card'];
      if (!allowedPayment.includes(paymentMethod)) { setError('invalid_payment_method'); setLoading(false); return; }
      const mode = await rideReq.submit({ pickupLat, pickupLng, dropLat, dropLng, productType, paymentMethod });
      if (mode === 'immediate' && rideReq.ride) setResponse(rideReq.ride);
      if (token && !getSocket()) {
        const s = connectSocket(token);
        s.on('ride_status', (st) => { setStatuses(prev => [st, ...prev].slice(0, 50)); });
      }
    } catch (e:any) {
      setError(e.error || 'request_failed');
    } finally {
      setLoading(false);
      setLatencyMs(Math.round(performance.now() - start));
    }
  }

  const latestStatus = useMemo(()=> statuses[0]?.status as string | undefined, [statuses]);
  const hasActive = !!(response || statuses.length > 0);
  const pickupOk = !!(parseLat(pickupLat) !== null && parseLng(pickupLng) !== null);
  const dropOk = !!(parseLat(dropLat) !== null && parseLng(dropLng) !== null);
  const canRequestBase = pickupOk && dropOk && !!token && !loading;
  const cardOk = paymentMethod !== 'card' || hasCardCapability;
  const canRequest = canRequestBase && cardOk;

  // Fetch a fresh quote whenever pickup/drop/productType change and both points are valid
  useEffect(() => {
    let cancelled = false;
    async function doQuote() {
      if (!pickupOk || !dropOk) { setQuote(null); return; }
      try {
        setQuoting(true);
        const q = await api.getQuote({
          pickup: { lat: parseLat(pickupLat)!, lng: parseLng(pickupLng)! },
          dropoff: { lat: parseLat(dropLat)!, lng: parseLng(dropLng)! },
          productType
        });
        if (!cancelled) setQuote({ fare: (q as any).fare || (q as any).total || (q as any).amount, currency: (q as any).currency || 'NGN', eta: (q as any).eta });
      } catch {
        if (!cancelled) setQuote(null);
      } finally { if (!cancelled) setQuoting(false); }
    }
    doQuote();
    return () => { cancelled = true; };
  }, [pickupLat, pickupLng, dropLat, dropLng, productType]);

  return (
    <div className="max-w-3xl mx-auto p-4">
      {hasActive && (
        <div role="status" aria-live="polite" className="mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            <p className="text-sm font-medium">{loading? 'Requesting…' : friendlyStatus(latestStatus) || 'Preparing request…'}</p>
          </div>
          {latencyMs !== null && !loading && <span className="text-[11px] text-slate-500">{latencyMs}ms</span>}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">Book a ride</h2>
        </div>
        <div className="p-4 grid gap-4">
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm">Loading map…</div>}>
            <MapPicker
              pickup={{ lat: parseLat(pickupLat) || 0, lng: parseLng(pickupLng) || 0 }}
              dropoff={{ lat: parseLat(dropLat) || 0, lng: parseLng(dropLng) || 0 }}
              onChange={(val) => {
                if (val.pickup) { setPickupLat(String(val.pickup.lat)); setPickupLng(String(val.pickup.lng)); }
                if (val.dropoff) { setDropLat(String(val.dropoff.lat)); setDropLng(String(val.dropoff.lng)); }
              }}
            />
          </Suspense>
          {/* Fare/ETA summary card */}
          {(pickupOk && dropOk) && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-semibold">Trip summary</div>
                <div className="text-xs text-slate-500">{quoting? 'Calculating price…' : (quote? `ETA ${quote.eta ?? '—'} min (current conditions)` : 'ETA —')}
                  {' '}• {(() => { const d = kmDistance(parseLat(pickupLat)!, parseLng(pickupLng)!, parseLat(dropLat)!, parseLng(dropLng)!); return isFinite(d) ? `${d.toFixed(1)} km` : '—'; })()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold">{quoting? '—' : (quote?.fare ? `${(quote.currency||'NGN')} ${Math.round(quote.fare)}` : '—')}</div>
                <div className="text-[11px] text-slate-500">{productType === 'premium' ? 'Premium' : 'Standard'}</div>
              </div>
            </div>
          )}
          {paymentMethod==='card' && !hasCardCapability && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs p-3 flex items-center justify-between gap-3">
              <p className="m-0">To pay by card, add a card in Profile first. Or switch to Cash to request now.</p>
              <Link to="/profile" className="inline-flex items-center h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium whitespace-nowrap">Add a card</Link>
            </div>
          )}
          <form onSubmit={submit} className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Tap on the map to set pickup and destination.</p>
              <button type="button" onClick={()=>setShowAdvanced(v=>!v)} className="text-xs underline">
                {showAdvanced? 'Hide advanced':'Edit coordinates'}
              </button>
            </div>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium">Pickup
                  <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-900" value={pickupLat+','+pickupLng} onChange={e=>{
                    const parts = e.target.value.split(',');
                    if (parts.length===2) { setPickupLat(parts[0].trim()); setPickupLng(parts[1].trim()); }
                  }} aria-label="Pickup coordinates" />
                </label>
                <label className="text-xs font-medium">Destination
                  <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-900" value={dropLat+','+dropLng} onChange={e=>{
                    const parts = e.target.value.split(',');
                    if (parts.length===2) { setDropLat(parts[0].trim()); setDropLng(parts[1].trim()); }
                  }} aria-label="Destination coordinates" />
                </label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium">Product
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-900" value={productType} onChange={e=>setProductType(e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <label className="text-xs font-medium">Payment
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-900" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
                {paymentMethod==='card' && !hasCardCapability && (
                  <span className="mt-2 inline-flex items-center text-xs">
                    <Link to="/profile" className="ml-auto inline-flex items-center px-2.5 py-1.5 rounded-md bg-brand text-white hover:bg-brand-dark font-medium">Add a card</Link>
                  </span>
                )}
              </label>
            </div>
            <button disabled={!canRequest} title={!token? 'Login required':''} className="mt-2 h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-base disabled:opacity-50">{loading? 'Requesting…': (paymentMethod==='card'? 'Request Ride (Card)':'Request Ride')}</button>
            {rideReq.queued && !rideReq.error && <p className="text-xs text-slate-600">Ride request queued (offline / rate-limited). Sends automatically when back online.</p>}
            {rideReq.error && (
              <p className="text-sm text-red-600">
                {rideReq.error === 'payment_method_required' ? (
                  <>
                    Card setup required. Please <Link to="/profile" className="underline text-brand">add a card</Link> or switch to Cash.
                  </>
                ) : rideReq.error}
              </p>
            )}
          </form>
        </div>
      </div>
      {/* Sticky action bar for modern UX */}
      <div className="fixed left-0 right-0 bottom-0 z-20">
        <div className="mx-auto max-w-3xl px-4 pb-4">
          <div className="rounded-2xl shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between">
            <div className="text-sm">
              <div className="font-semibold">Ready to go?</div>
              <div className="text-slate-500 text-xs">{pickupOk? 'Pickup set':'Pick a pickup'} • {dropOk? 'Destination set':'Pick a destination'}</div>
            </div>
            <div className="flex items-center gap-2">
              {paymentMethod==='card' && !hasCardCapability && (
                <Link to="/profile" className="inline-flex items-center h-10 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium whitespace-nowrap">Add a card</Link>
              )}
              <button onClick={submitDirect} disabled={!canRequest} title={!token? 'Login required': (!cardOk? 'Add a card in Profile or switch to Cash':'')} className={`h-12 px-5 rounded-xl font-semibold text-white ${canRequest? 'bg-brand hover:bg-brand-dark':'bg-slate-400'} `}>
                {loading? 'Requesting…': (paymentMethod==='card'? 'Request (Pay by card)':'Request Ride')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="h-20" />
      {hasActive && (
        <SosButton onClick={()=> alert('Emergency services have been notified. Stay safe.')} />
      )}
    </div>
  );
}
