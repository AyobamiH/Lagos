import React, { useState, lazy, Suspense, useRef } from 'react';
import { parseLat, parseLng } from '../../utils/validation';
import { formatCurrencyNGN } from '../../utils/format';
const MapPicker = lazy(()=>import('../../components/MapPicker').then(m=>({ default: m.MapPicker })));
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { recordAction } from '../../rum/clientRUM';

export default function QuoteAndRequest() {
  const { token } = useAuth();
  const [pickup, setPickup] = useState({ lat: '6.5244', lng:'3.3792' });
  const [dropoff, setDropoff] = useState({ lat: '37.7849', lng:'-122.4094' });
  const [productType, setProductType] = useState('standard');
  const [quote, setQuote] = useState<any|null>(null);
  const [rideResp, setRideResp] = useState<any|null>(null);
  const [now, setNow] = useState(Date.now());
  React.useEffect(()=>{ const id = setInterval(()=> setNow(Date.now()), 1000); return ()=>clearInterval(id); },[]);
  const [error, setError] = useState<string|null>(null);
  const [latencyMs, setLatencyMs] = useState<number|null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [autoRefreshNotice, setAutoRefreshNotice] = useState<string|null>(null);
  const autoRefreshingRef = useRef(false);

  async function getQuote(e?: React.FormEvent) {
    if (e) e.preventDefault(); if (!token) { setError('not_authenticated'); return; }
  setError(null); setQuote(null); setRideResp(null); setLatencyMs(null); setAutoRefreshNotice(null);
  setQuoteLoading(true);
    const start = performance.now();
    const actionStart = performance.now();
    try {
  const pLat = parseLat(pickup.lat); const pLng = parseLng(pickup.lng); const dLat = parseLat(dropoff.lat); const dLng = parseLng(dropoff.lng);
  if ([pLat,pLng,dLat,dLng].some(v=>v===null)) throw { error:'invalid_coordinates' };
  const json = await api.getQuote({ pickup: { lat: pLat!, lng: pLng! }, dropoff: { lat: dLat!, lng: dLng! }, productType });
      setQuote(json);
      recordAction('get_quote_success', { productType }, actionStart);
    } catch (e:any) {
      const code = e?.code || e?.error;
      if (code === 'rate_limited') setError('rate_limited'); else setError(code || 'quote_failed');
    }
    setLatencyMs(Math.round(performance.now()-start));
    setQuoteLoading(false);
  }

  async function requestWithQuote() {
    if (!token || !quote) return;
  setError(null); setRideResp(null); setRequestLoading(true); setAutoRefreshNotice(null);
    const actionStart = performance.now();
    try {
      const pLat = parseLat(pickup.lat); const pLng = parseLng(pickup.lng); const dLat = parseLat(dropoff.lat); const dLng = parseLng(dropoff.lng);
      if ([pLat,pLng,dLat,dLng].some(v=>v===null)) throw { error:'invalid_coordinates' };
      const payload = {
        pickup: { lat: pLat!, lng: pLng! },
        dropoff: { lat: dLat!, lng: dLng! },
        productType,
        quotePayload: quote.payload,
        quoteSignature: quote.signature,
        quoteId: quote.quoteId
      } as any;
      const json = await api.rideRequest(token, payload);
      setRideResp(json);
      recordAction('request_ride_success', { productType }, actionStart);
    } catch (e:any) {
      const code = e?.code || e?.error;
      if (['expired_quote','invalid_quote_signature','quote_mismatch','quote_replay_detected','invalid_quote_payload','stateless_required_missing_payload'].includes(code)) {
        if (!autoRefreshingRef.current) {
          autoRefreshingRef.current = true;
          try { setAutoRefreshNotice('Refreshing quote due to validation issue'); await getQuote(); } catch {}
          autoRefreshingRef.current = false;
        }
        setError(code);
      } else {
        setError(code || 'ride_failed');
      }
    }
    setRequestLoading(false);
  }

  return (
    <div style={{display:'grid', gap:16}}>
      <h2>Quote & Request</h2>
      <form aria-label="Get ride quote" onSubmit={getQuote} style={{display:'grid', gap:8, maxWidth:380}}>
        <div style={{display:'flex', gap:8}}>
          <label style={{flex:1}}>Pickup Lat
            <input aria-label="Pickup latitude" value={pickup.lat} onChange={e=>setPickup(p=>({...p,lat:e.target.value}))} />
          </label>
          <label style={{flex:1}}>Pickup Lng
            <input aria-label="Pickup longitude" value={pickup.lng} onChange={e=>setPickup(p=>({...p,lng:e.target.value}))} />
          </label>
        </div>
        <div style={{display:'flex', gap:8}}>
          <label style={{flex:1}}>Drop Lat
            <input aria-label="Dropoff latitude" value={dropoff.lat} onChange={e=>setDropoff(d=>({...d,lat:e.target.value}))} />
          </label>
          <label style={{flex:1}}>Drop Lng
            <input aria-label="Dropoff longitude" value={dropoff.lng} onChange={e=>setDropoff(d=>({...d,lng:e.target.value}))} />
          </label>
        </div>
        <label>Product Type
          <select aria-label="Product type" value={productType} onChange={e=>setProductType(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <button aria-label="Fetch fare quote" disabled={quoteLoading}>{quoteLoading? 'Fetching...' : 'Get Quote'}</button>
      </form>
      {latencyMs !== null && <span style={{fontSize:12, opacity:0.7}}>quote lat {latencyMs}ms</span>}
      <Suspense fallback={<div style={{height:300,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading map...</div>}>
  <MapPicker
  pickup={{ lat: parseLat(pickup.lat) || 0, lng: parseLng(pickup.lng) || 0 }}
  dropoff={{ lat: parseLat(dropoff.lat) || 0, lng: parseLng(dropoff.lng) || 0 }}
        onChange={(val)=>{
          const p = (val as any).pickup; const d = (val as any).dropoff;
          if (p && typeof p.lat === 'number') setPickup(prev=>({ ...prev, lat: String(p.lat), lng: String(p.lng) }));
          if (d && typeof d.lat === 'number') setDropoff(prev=>({ ...prev, lat: String(d.lat), lng: String(d.lng) }));
        }}
      />
      </Suspense>
      {quote && (
        <div style={{background:'#f0f8ff', padding:8, borderRadius:4}} aria-live="polite">
          <h3 style={{marginTop:0}}>Quote</h3>
          <p>Total: {formatCurrencyNGN(quote.total)} (surge {quote.surgeMultiplier})</p>
          {quote.expiresAt && (
            <p aria-label="Quote expiry" style={{fontSize:12, marginTop:4}}>
              Expires in {Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - now)/1000))}s
            </p>
          )}
          <div style={{display:'flex', gap:8}}>
            <button aria-label="Request ride with this quote" onClick={requestWithQuote} disabled={requestLoading || (quote.expiresAt && new Date(quote.expiresAt).getTime() < now)}>{requestLoading? 'Requesting...' : 'Request With Quote'}</button>
            {quote.expiresAt && new Date(quote.expiresAt).getTime() < now && (
              <button aria-label="Refresh expired quote" onClick={()=>getQuote()}>Refresh Quote</button>
            )}
          </div>
          <pre>{JSON.stringify(quote,null,2)}</pre>
        </div>
      )}
      {rideResp && (
        <div style={{background:'#f5f5f5', padding:8, borderRadius:4}}>
          <h3 style={{marginTop:0}}>Ride Response</h3>
          <pre>{JSON.stringify(rideResp,null,2)}</pre>
        </div>
      )}
  {error && <p style={{color:'red'}} aria-live="assertive">{error}</p>}
  {autoRefreshNotice && <p style={{color:'#555', fontSize:12}} aria-live="polite">{autoRefreshNotice}</p>}
      {error && ['expired_quote','quote_mismatch','quote_replay_detected'].includes(error) && !quote && (
        <button onClick={()=>{ if (!autoRefreshingRef.current) getQuote(); }} style={{width:180}} disabled={autoRefreshingRef.current}>
          {autoRefreshingRef.current ? 'Refreshing...' : 'Recalculate Quote'}
        </button>
      )}
    </div>
  );
}
