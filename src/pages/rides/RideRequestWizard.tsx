import React, { useState, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
// import { createRide } from '../../services/rideService'; // legacy direct path
import { api } from '../../api/client';
import { parseLat, parseLng } from '../../utils/validation';
import { formatCurrencyNGN } from '../../utils/format';
import { useMutationQueue } from '../../context/MutationQueueContext';
import { useRideRequest } from '../../hooks/useRideRequest';

const MapPicker = lazy(()=>import('../../components/MapPicker').then(m=>({ default: m.MapPicker })));

export const RideRequestWizard: React.FC = () => {
  const { token } = useAuth();
  const [step, setStep] = useState<'form'|'quote'|'confirm'|'result'>('form');
  const [pickup, setPickup] = useState({ lat:'6.5244', lng:'3.3792' });
  const [dropoff, setDropoff] = useState({ lat:'37.7849', lng:'-122.4094' });
  const [productType, setProductType] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [quote, setQuote] = useState<any|null>(null);
  const [ride, setRide] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const mq = useMutationQueue();
  const rideReq = useRideRequest();

  async function getQuote() {
    if (!token) { setError('not_authenticated'); return; }
    const pLat = parseLat(pickup.lat); const pLng = parseLng(pickup.lng); const dLat = parseLat(dropoff.lat); const dLng = parseLng(dropoff.lng);
    if ([pLat,pLng,dLat,dLng].some(v=>v===null)) { setError('invalid_coordinates'); return; }
    setLoading(true); setError(null);
    try { const q = await api.getQuote({ pickup:{ lat:pLat!, lng:pLng!}, dropoff:{ lat:dLat!, lng:dLng!}, productType }); setQuote(q); setStep('quote'); }
    catch(e:any){ setError(e.error || 'quote_failed'); }
    setLoading(false);
  }
  async function requestRide() {
    if (!token) return; setLoading(true); setError(null); setQueued(false);
    try {
  const allowedPayment = ['cash','card'];
  if (!allowedPayment.includes(paymentMethod)) { setError('invalid_payment_method'); setLoading(false); return; }
  const mode = await rideReq.submit({ pickupLat: pickup.lat, pickupLng: pickup.lng, dropLat: dropoff.lat, dropLng: dropoff.lng, productType, paymentMethod });
      if (mode === 'queued') { setQueued(true); setRide(null); }
      if (mode === 'immediate' && rideReq.ride) { setRide(rideReq.ride); }
      setStep('result');
    } catch(e:any){ setError(e.error || 'request_failed'); }
    setLoading(false);
  }

  return (
    <div style={{display:'grid', gap:12}}>
      <h2>Ride Wizard</h2>
      {error && <p style={{color:'red'}}>{error}</p>}
      {step==='form' && (
        <div style={{display:'grid', gap:8, maxWidth:420}}>
          <div style={{display:'flex', gap:8}}>
            <label style={{flex:1}}>Pickup Lat<input value={pickup.lat} onChange={e=>setPickup(p=>({...p,lat:e.target.value}))}/></label>
            <label style={{flex:1}}>Pickup Lng<input value={pickup.lng} onChange={e=>setPickup(p=>({...p,lng:e.target.value}))}/></label>
          </div>
          <div style={{display:'flex', gap:8}}>
            <label style={{flex:1}}>Drop Lat<input value={dropoff.lat} onChange={e=>setDropoff(d=>({...d,lat:e.target.value}))}/></label>
            <label style={{flex:1}}>Drop Lng<input value={dropoff.lng} onChange={e=>setDropoff(d=>({...d,lng:e.target.value}))}/></label>
          </div>
          <label>Product Type
            <select value={productType} onChange={e=>setProductType(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </label>
          <label>Payment Method
            <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </label>
          <button disabled={loading} onClick={getQuote}>{loading? 'Loading...' : 'Get Quote'}</button>
        </div>
      )}
      {step==='quote' && quote && (
        <div style={{display:'grid', gap:8}}>
          <p>Quote Total: {formatCurrencyNGN(quote.total)} (surge {quote.surgeMultiplier || 1})</p>
          <div style={{display:'flex', gap:8}}>
            <button disabled={loading} onClick={()=>setStep('form')}>Back</button>
            <button disabled={loading} onClick={requestRide}>{loading? 'Requesting...' : 'Request Ride'}</button>
          </div>
        </div>
      )}
      {step==='result' && (
        <div style={{display:'grid', gap:8}}>
          {(queued || rideReq.queued) && !ride && <p style={{color:'#555'}}>Ride request queued. It will be sent automatically when online & not rate-limited.</p>}
          {(ride || rideReq.ride) && <>
            <h3>Ride Created</h3>
            <pre>{JSON.stringify(ride || rideReq.ride,null,2)}</pre>
          </>}
        </div>
      )}
      <Suspense fallback={<div style={{height:300, display:'flex',alignItems:'center',justifyContent:'center'}}>Loading map...</div>}>
        <MapPicker pickup={{ lat: parseLat(pickup.lat)||0, lng: parseLng(pickup.lng)||0 }} dropoff={{ lat: parseLat(dropoff.lat)||0, lng: parseLng(dropoff.lng)||0 }} onChange={(val)=>{
          if (val.pickup) setPickup({ lat:String(val.pickup.lat), lng:String(val.pickup.lng) });
          if (val.dropoff) setDropoff({ lat:String(val.dropoff.lat), lng:String(val.dropoff.lng) });
        }}/>
      </Suspense>
    </div>
  );
};
