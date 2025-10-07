import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../api/client';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths for leaflet in bundlers
// Fix default icon paths for leaflet in bundlers
// Suppress potential undefined prototype warning with optional chaining
delete (L.Icon.Default.prototype as any)?._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

interface MapPickerProps {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  onChange: (val: { pickup?: { lat: number; lng: number }; dropoff?: { lat: number; lng: number } }) => void;
}

type PlaceSuggestion = { label: string; lat: number; lng: number; source: 'recent'|'geocode' };
const RECENTS_KEY = 'rh_recent_places_v1';
function loadRecents(): PlaceSuggestion[] {
  try { const raw = localStorage.getItem(RECENTS_KEY); if (!raw) return []; const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.filter(Boolean); } catch {}
  return [];
}
function saveRecent(p: PlaceSuggestion) {
  try {
    const cur = loadRecents();
    const deduped = cur.filter(x => x.label.toLowerCase() !== p.label.toLowerCase());
    const next = [{ ...p, source: 'recent' as const }, ...deduped].slice(0, 10);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {}
}

const ClickHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
  useMapEvents({
  click(e: any) { if (e && e.latlng) onMapClick(e.latlng.lat, e.latlng.lng); }
  });
  return null;
};

function GeocoderControls({ onPickup, onDropoff, onPanTo }: { onPickup: (lat:number,lng:number)=>void; onDropoff: (lat:number,lng:number)=>void; onPanTo: (lat:number,lng:number)=>void }) {
  const [qPickup, setQPickup] = useState('');
  const [qDrop, setQDrop] = useState('');
  const [locBusy, setLocBusy] = useState(false);
  const [sugsPickup, setSugsPickup] = useState<PlaceSuggestion[]>([]);
  const [sugsDrop, setSugsDrop] = useState<PlaceSuggestion[]>([]);
  const recents = useMemo(() => loadRecents(), []);
  function mergeSuggestions(query: string, remote: PlaceSuggestion[]): PlaceSuggestion[] {
    const q = query.trim().toLowerCase();
    const local = recents
      .filter(r => !q || r.label.toLowerCase().includes(q))
      .map(r => ({ ...r, source: 'recent' as const }));
    const dedupLabels = new Set(local.map(l => l.label.toLowerCase()));
    const merged: PlaceSuggestion[] = [...local];
    for (const r of remote) { if (!dedupLabels.has(r.label.toLowerCase())) merged.push(r); }
    return merged.slice(0, 8);
  }
  async function search(query: string) {
    if (!query.trim()) return null;
    try {
      const url = `${API_BASE}/geocode?q=${encodeURIComponent(query.trim())}&limit=5&country=ng`;
      const res = await fetch(url, { headers: { 'Accept':'application/json' } });
      if (!res.ok) throw new Error(`nominatim_http_${res.status}`);
      const json = await res.json();
      const mapped: PlaceSuggestion[] = Array.isArray(json) ? json.slice(0, 5).map((it:any) => ({
        label: String(it.display_name || it.name || query),
        lat: parseFloat(it.lat),
        lng: parseFloat(it.lon),
        source: 'geocode'
      })) : [];
      return mapped;
    } catch (e:any) {
      try { console.warn('Geocoding failed', e?.message || e); } catch {}
      try { window.alert('Address lookup failed. If you are offline or a browser extension blocked the request, try again or disable the blocker.'); } catch {}
    }
    return null;
  }
  // Debounced live suggestions for pickup
  useEffect(() => {
    let active = true; const q = qPickup.trim(); if (!q) { setSugsPickup(mergeSuggestions('', [])); return; }
    const t = setTimeout(async () => {
      const remote = await search(q);
      if (!active) return;
      const merged = mergeSuggestions(q, Array.isArray(remote)? remote: []);
      setSugsPickup(merged);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [qPickup]);
  // Debounced live suggestions for dropoff
  useEffect(() => {
    let active = true; const q = qDrop.trim(); if (!q) { setSugsDrop(mergeSuggestions('', [])); return; }
    const t = setTimeout(async () => {
      const remote = await search(q);
      if (!active) return;
      const merged = mergeSuggestions(q, Array.isArray(remote)? remote: []);
      setSugsDrop(merged);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [qDrop]);
  async function useMyLocation() {
    if (!('geolocation' in navigator)) return;
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords || {} as any;
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        onPickup(latitude, longitude);
        try { onPanTo(latitude, longitude); } catch {}
      }
      setLocBusy(false);
    }, () => { setLocBusy(false); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
  }
  return (
    <div style={{ display:'grid', gap:6, marginBottom:8 }}>
      <div style={{ display:'flex', gap:6, position:'relative' }}>
        <input aria-label="Search pickup" placeholder="Search pickup (e.g., Ikeja City Mall)" value={qPickup} onChange={e=>setQPickup(e.target.value)} style={{ flex:1, padding:'6px 8px', border:'1px solid #ccc', borderRadius:6 }}/>
        <button onClick={async()=>{ const list = await search(qPickup); if (Array.isArray(list) && list[0]) { const r = list[0]; onPickup(r.lat, r.lng); try { saveRecent(r); } catch{}; } }} style={{ padding:'6px 10px', borderRadius:6 }}>Search</button>
        <button onClick={useMyLocation} disabled={locBusy} title="Use my current location" style={{ padding:'6px 10px', borderRadius:6 }}>{locBusy? 'Loc…' : 'Use my location'}</button>
      </div>
      {sugsPickup.length > 0 && (
        <div role="listbox" aria-label="Pickup suggestions" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, overflow:'hidden' }}>
          {sugsPickup.map((s, i) => (
            <button key={s.label+String(i)} onClick={()=>{ onPickup(s.lat, s.lng); setQPickup(s.label); try { saveRecent(s); } catch{}; try { onPanTo(s.lat, s.lng); } catch{}; }}
              style={{ display:'flex', width:'100%', textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #f1f5f9', background:'white' }}>
              <span style={{ fontSize:12, color:'#111827' }}>{s.label}</span>
              {s.source==='recent' && <span style={{ marginLeft:'auto', fontSize:10, color:'#6b7280' }}>Recent</span>}
            </button>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:6, position:'relative' }}>
        <input aria-label="Search destination" placeholder="Search destination (e.g., Lekki Phase 1, 12 Admiralty Way)" value={qDrop} onChange={e=>setQDrop(e.target.value)} style={{ flex:1, padding:'6px 8px', border:'1px solid #ccc', borderRadius:6 }}/>
        <button onClick={async()=>{ const list = await search(qDrop); if (Array.isArray(list) && list[0]) { const r = list[0]; onDropoff(r.lat, r.lng); try { saveRecent(r); } catch{}; } }} style={{ padding:'6px 10px', borderRadius:6 }}>Search</button>
      </div>
      {sugsDrop.length > 0 && (
        <div role="listbox" aria-label="Destination suggestions" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, overflow:'hidden' }}>
          {sugsDrop.map((s, i) => (
            <button key={s.label+String(i)} onClick={()=>{ onDropoff(s.lat, s.lng); setQDrop(s.label); try { saveRecent(s); } catch{}; try { onPanTo(s.lat, s.lng); } catch{}; }}
              style={{ display:'flex', width:'100%', textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #f1f5f9', background:'white' }}>
              <span style={{ fontSize:12, color:'#111827' }}>{s.label}</span>
              {s.source==='recent' && <span style={{ marginLeft:'auto', fontSize:10, color:'#6b7280' }}>Recent</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const MapPicker: React.FC<MapPickerProps> = ({ pickup, dropoff, onChange }) => {
  const toggleRef = useRef<'pickup' | 'dropoff'>('pickup');
  const [panTarget, setPanTarget] = useState<[number, number] | null>(null);
  function handleClick(lat: number, lng: number) {
    if (toggleRef.current === 'pickup') {
      onChange({ pickup: { lat, lng } });
      toggleRef.current = 'dropoff';
    } else {
      onChange({ dropoff: { lat, lng } });
      toggleRef.current = 'pickup';
    }
  }
  const MapPan: React.FC<{ to: [number, number] | null }> = ({ to }) => {
    const map = useMap();
    useEffect(() => {
      if (to) {
        try { map.flyTo(to, Math.max(map.getZoom(), 14)); } catch {}
      }
    }, [to]);
    return null;
  };
  const FitBounds: React.FC<{ a?: {lat:number;lng:number}, b?: {lat:number;lng:number} }> = ({ a, b }) => {
    const map = useMap();
    useEffect(() => {
      if (!a || !b) return;
      const valid = (v:any) => typeof v?.lat==='number' && typeof v?.lng==='number' && !Number.isNaN(v.lat) && !Number.isNaN(v.lng);
      if (!valid(a) || !valid(b)) return;
      const bounds = L.latLngBounds([a.lat, a.lng], [b.lat, b.lng]);
      try { map.fitBounds(bounds, { padding: [24,24], maxZoom: 16 }); } catch {}
    }, [a?.lat, a?.lng, b?.lat, b?.lng]);
    return null;
  };
  return (
    <div style={{height:360}}>
      <div style={{fontSize:12, marginBottom:6}}>Click map to set {toggleRef.current} point, or use search below. Markers are draggable.</div>
      <div>
        <GeocoderControls onPanTo={(lat,lng)=>setPanTarget([lat,lng])} onPickup={(lat,lng)=>onChange({ pickup:{ lat,lng } })} onDropoff={(lat,lng)=>onChange({ dropoff:{ lat,lng } })} />
      </div>
      {/* Use a fixed pixel height to avoid percentage height issues inside grid/flex parents */}
      <MapContainer center={[pickup.lat || 6.5244, pickup.lng || 3.3792]} zoom={13} style={{height:280, width:'100%', borderRadius:12, overflow:'hidden'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <MapPan to={panTarget} />
        <FitBounds a={{ lat: pickup.lat, lng: pickup.lng }} b={{ lat: dropoff.lat, lng: dropoff.lng }} />
        <Marker
          position={[pickup.lat, pickup.lng]}
          draggable={true as any}
          eventHandlers={{ dragend: (e:any) => { const ll = e.target.getLatLng(); onChange({ pickup: { lat: ll.lat, lng: ll.lng } }); } }}
        />
        <Marker
          position={[dropoff.lat, dropoff.lng]}
          draggable={true as any}
          eventHandlers={{ dragend: (e:any) => { const ll = e.target.getLatLng(); onChange({ dropoff: { lat: ll.lat, lng: ll.lng } }); } }}
        />
        <ClickHandler onMapClick={handleClick} />
      </MapContainer>
    </div>
  );
};
