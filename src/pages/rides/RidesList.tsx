import React, { useEffect, useState } from 'react';
import { formatCurrencyNGN } from '../../utils/format';
import { fetchRidesWithMeta } from '../../data/rides';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { useRealtime } from '../../context/RealtimeContext';

interface RideSummary { _id: string; status: string; fare: number; createdAt: string; surgeMultiplier?: number; }

export default function RidesList() {
  const { token, profile } = useAuth();
  const { lastUpdates, connected, reconnect } = useRealtime();
  const [rides, setRides] = useState<RideSummary[]>([]);
  const [rideIndex, setRideIndex] = useState<Record<string, RideSummary>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [listEtag, setListEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState<string|null>(null);
  const [done, setDone] = useState(false);

  async function loadMore(reset=false) {
    if (!token || profile?.role === 'driver' || loading || (done && !reset)) return;
    setLoading(true); setError(null);
    try {
  // Only send ETag for the first page (cursor null) to avoid unnecessary 304s on subsequent pages
  const sendEtag = (reset || !cursor) ? (reset ? null : listEtag) : null;
  const result = await fetchRidesWithMeta(token, reset ? null : cursor, statusFilter || undefined, sendEtag);
      if (result.notModified) {
        // nothing to change
      } else if (result.page) {
        const page = result.page;
        const normalized = (page.rides || []).map(r => ({ ...r, fare: (r as any).fare ?? 0 } as RideSummary));
        setRideIndex(prev => {
          const next = reset ? {} : { ...prev };
          for (const r of normalized) {
            const existing = next[r._id];
            if (!existing || new Date(r.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
              // Keep older createdAt ordering reference (we'll sort later) but always merge status/fare
              next[r._id] = { ...existing, ...r } as RideSummary;
            } else {
              // Merge new data into existing (prefer freshest fields)
              next[r._id] = { ...r, ...existing } as RideSummary;
            }
          }
          // Rebuild ordered list by createdAt asc (or desc if desired); maintain stable display
          const ordered = Object.values(next).sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRides(ordered);
          return next;
        });
        if (page.nextCursor) setCursor(page.nextCursor); else setDone(true);
      }
      if (result.etag) setListEtag(result.etag);
    } catch (e:any) { setError(e.error || 'load_failed'); }
    setLoading(false);
  }

  useEffect(() => { if (token && profile?.role !== 'driver') { loadMore(true); } }, [token, profile?.role, statusFilter]);

  const enriched = rides.map(r => lastUpdates[r._id] ? { ...r, status: lastUpdates[r._id].status } : r);

  return (
    <div style={{display:'grid', gap:12}}>
      <h2>My Rides</h2>
      {profile?.role === 'driver' && <p style={{color:'red'}}>forbidden</p>}
      {!connected && <div style={{background:'#ffe8e8', padding:8, border:'1px solid #f99', borderRadius:4, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span style={{color:'#b00', fontSize:12}}>Realtime disconnected - using polling</span>
        <button onClick={reconnect} style={{fontSize:12}}>Reconnect</button>
      </div>}
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <label style={{fontSize:12}}>Filter status
          <select aria-label="Filter rides by status" value={statusFilter} onChange={e=>{ setStatusFilter(e.target.value); setCursor(null); setDone(false); }} style={{marginLeft:6}}>
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="searching">Searching</option>
            <option value="offer_pending">Offer Pending</option>
          </select>
        </label>
      </div>
      <ul role="list" aria-label="Rides" style={{listStyle:'none', margin:0, padding:0, display:'grid', gap:6}}>
        {enriched.map(r => (
          <li key={r._id} data-testid="ride-item" aria-label={`Ride ${r._id} status ${r.status}`} style={{background:'#fafafa', padding:8, borderRadius:4, display:'flex', justifyContent:'space-between'}}>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <strong role="status" aria-live="polite">{r.status}</strong>
                {r.surgeMultiplier && r.surgeMultiplier !== 1 && (
                  <span aria-label="Surge multiplier" style={{background:'#ffe08a', color:'#8a5600', fontSize:10, padding:'2px 4px', borderRadius:4}}>
                    Surge x{r.surgeMultiplier}
                  </span>
                )}
              </div>
              <span style={{fontSize:11}}>{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span aria-label="Fare">{formatCurrencyNGN(r.fare)}</span>
              <Link aria-label={`View ride ${r._id}`} to={`/rides/${r._id}`}>View</Link>
            </div>
          </li>
        ))}
      </ul>
      {!done && <button aria-label="Load more rides" disabled={loading} onClick={()=>loadMore(false)}>{loading? 'Loading...' : 'Load More'}</button>}
      {error && <p style={{color:'red'}}>{error}</p>}
    </div>
  );
}
