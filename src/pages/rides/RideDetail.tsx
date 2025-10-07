import React, { useEffect, useState } from 'react';
import { formatCurrencyNGN } from '../../utils/format';
import { useParams } from 'react-router-dom';
import { api, request, getLastResponseHeaders, classifyError } from '../../api/client';
import { t } from '../../i18n/messages';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { RideLiveMap } from '../../components/RideLiveMap';
import { useToast } from '../../context/ToastContext';
import { ActiveRideCard } from '../../components/skeleton/ActiveRideCard';
import { RideTimeline } from '../../components/skeleton/RideTimeline';
import { PaymentWidget } from '../../components/payments/PaymentWidget';
import { StatusBadge } from '../../components/StatusBadge';
import { RideCardSkeleton, TimelineSkeleton, PaymentWidgetSkeleton } from '../../components/skeleton/Skeleton';
import { SosButton } from '../../components/SosButton';

export default function RideDetail() {
  const { token } = useAuth();
  const params = useParams();
  const rideId = (params as any).rideId || (params as any).id; // support both /rides/:rideId and /rides/:id
  const { lastUpdates, lastDriverPositions } = useRealtime();
  const [ride, setRide] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [etag, setEtag] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [mutating, setMutating] = useState(false);
  const { push } = useToast();

  async function fetchRide() {
    if (!token || !rideId) return;
    setLoading(true); setError(null);
    try {
      const detail = await api.rideDetail(token, rideId);
      // Normalize eta drift (eta -> etaMinutes) if present
      if (detail && (detail as any).eta && !(detail as any).etaMinutes) {
        (detail as any).etaMinutes = (detail as any).eta;
      }
      setRide(detail);
      const headers = getLastResponseHeaders();
      if (headers.etag) setEtag(headers.etag);
    } catch (e:any) { setError(e.friendlyMessage || e.error || 'load_failed'); }
    setLoading(false);
  }

  useEffect(() => { fetchRide(); }, [token, rideId]);

  const live = (rideId && lastUpdates[rideId]) ? lastUpdates[rideId] : null;
  const currentStatus = live?.status || ride?.status;

  async function cancelRide() {
    if (!token || !rideId) return;
    setCanceling(true); setError(null);
    // Optimistic local state update
  setRide((r: any) => r ? { ...r, status: 'cancelled', cancellation: { reason: 'user_cancel', actor: 'rider', optimistic: true } } : r);
    try {
      const json = await request(`/rides/${rideId}/cancel`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ reason:'user_cancel' }) });
      setRide((r: any) => r ? { ...r, status: json.status, cancellation: json.cancellation } : r);
      push({ message:`Ride ${rideId} cancelled`, type:'info' });
    } catch(e:any) {
      setError(e.friendlyMessage || e.error || 'cancel_failed');
      push({ message: e.friendlyMessage || e.error || 'Cancel failed', type:'error' });
      // rollback optimistic change by refetching
      await fetchRide();
    }
    setCanceling(false);
  }

  async function mutateRide(newProductType: string) {
    if (!token || !rideId) return;
    setError(null); setMutating(true);
    let attemptedReplay = false;
    while (true) {
      try {
        const patch = await api.patchRide(token, rideId, { productType: newProductType }, etag || undefined);
        await fetchRide();
        if (patch && patch.rideId) push({ message: 'Ride updated', type:'info' });
        break;
      } catch (e:any) {
        const cls = classifyError(e);
        if ((cls.precondition || cls.conflict) && !attemptedReplay) {
          attemptedReplay = true;
          await fetchRide(); // refresh ETag & state then retry once
          continue;
        } else if (e.code === 'immutable_state') {
          push({ message: t('lifecycle_immutable_state', 'Ride no longer mutable'), type:'info' });
          await fetchRide();
          break;
        } else {
          setError(e.friendlyMessage || e.error || 'update_failed');
          push({ message: e.friendlyMessage || 'Update failed', type:'error' });
          break;
        }
      }
    }
    setMutating(false);
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Ride {rideId}</h2>
      {loading && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <RideCardSkeleton />
          <TimelineSkeleton />
          <PaymentWidgetSkeleton />
        </div>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {ride && (
        <div className="rounded-2xl shadow p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm flex items-center gap-2"><span className="font-medium">Status:</span> <StatusBadge status={currentStatus} /></p>
            {etag && <p className="text-[10px] text-gray-400 select-all" title="ETag used for concurrency control">{etag}</p>}
          </div>
          {ride && (ride as any).driver && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40" aria-label="Driver info">
              <img src={(ride as any).driver.photoUrl || ''} alt="Driver" className="w-10 h-10 rounded-full object-cover bg-slate-200" onError={(e:any)=>{ e.currentTarget.style.display='none'; }} />
              <div className="text-sm">
                <p className="font-medium">{(ride as any).driver.name || 'Your driver'}</p>
                <p className="text-xs text-slate-500">Plate: {(ride as any).driver.plate || (ride as any).driver.licensePlate || '—'}</p>
              </div>
            </div>
          )}
          {ride?.etaMinutes && <p className="text-sm"><span className="font-medium">ETA:</span> {ride.etaMinutes}m</p>}
          {/* Live map: show pickup/dropoff and real-time driver position if available */}
          <div className="mt-2">
            <RideLiveMap ride={ride} driver={lastDriverPositions?.[rideId || '']} height={260} />
          </div>
          {ride.surgeMultiplier && (
            <p className="text-xs"><span className="font-medium">Surge:</span> x{ride.surgeMultiplier}</p>
          )}
          {Array.isArray((ride as any).fareBreakdown) && (ride as any).fareBreakdown.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/40 p-3 rounded-lg" aria-label="Fare breakdown">
              <h3 className="text-sm font-medium mb-2">Fare Breakdown</h3>
              <ul className="space-y-1 text-xs">
                {(ride as any).fareBreakdown.map((it:any, idx:number)=>(
                  <li key={idx} className="flex justify-between">
                    <span>{it.label || it.type || 'Component'}</span>
                    <span>{typeof it.amount === 'number' ? formatCurrencyNGN(it.amount) : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm"><span className="font-medium">Fare:</span> {formatCurrencyNGN(ride.fare)}</p>
          {ride.finalFare && <p className="text-sm"><span className="font-medium">Final Fare:</span> {formatCurrencyNGN(ride.finalFare)}</p>}
          <RideTimeline ride={ride} />
          {currentStatus && !['completed','cancelled','expired'].includes(currentStatus) && (
            <div className="flex flex-wrap gap-3 items-center">
              <button disabled={canceling} onClick={cancelRide} className="h-12 px-5 rounded-xl text-base font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                {canceling ? 'Cancelling…' : 'Cancel Ride'}
              </button>
              <label className="text-xs font-medium">Product:</label>
              <select aria-label="Change product type" value={ride.productType || 'standard'} disabled={mutating} onChange={e=>mutateRide(e.target.value)} className="border rounded-md px-2 py-1 text-sm dark:bg-slate-900">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="van">Van</option>
              </select>
              {mutating && <span className="text-xs text-gray-500">Updating...</span>}
            </div>
          )}
          <div className="pt-2">
            <PaymentWidget rideId={ride._id} />
          </div>
        </div>
      )}
      <ActiveRideCard ride={ride} />
      {currentStatus && !['completed','cancelled','expired'].includes(currentStatus) && (
        <SosButton onClick={async ()=>{
          try {
            if (!token || !rideId) return;
            await request(`/rides/${rideId}/sos`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({}) });
            push({ message:'SOS sent to your driver. Stay safe.', type:'info', ttl:6000 });
          } catch (e:any) {
            push({ message: e?.friendlyMessage || 'Failed to send SOS', type:'error' });
          }
        }} />
      )}
    </div>
  );
}
