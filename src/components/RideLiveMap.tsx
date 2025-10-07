import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon paths for Leaflet (similar to MapPicker)
// This avoids broken marker images when bundling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(L.Icon.Default as any).mergeOptions?.({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

interface RideLike {
  pickup?: any;
  dropoff?: any;
}

export interface DriverPosition { lat:number; lng:number; heading?:number; ts:number; driverId?:string }

function extractLatLng(point: any): { lat:number; lng:number } | null {
  if (!point) return null;
  // Support backend GeoJSON-like { type:'Point', coordinates:[lng,lat] }
  if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    const [lng, lat] = point.coordinates as [number, number];
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  // Support plain { lat, lng }
  if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    return { lat: Number(point.lat), lng: Number(point.lng) };
  }
  return null;
}

function ease(t:number) { return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }

// Create a small pulsing divIcon for the driver marker
const pulseCss = `
.driver-pulse { width: 12px; height: 12px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 0 0 rgba(34,197,94, 0.7); animation: pulse 1.6s infinite; border:2px solid #052e16; }
@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34,197,94, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(34,197,94, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34,197,94, 0); } }`;
if (typeof document !== 'undefined' && !document.getElementById('driver-pulse-style')) {
  const style = document.createElement('style'); style.id = 'driver-pulse-style'; style.innerHTML = pulseCss; document.head.appendChild(style);
}
const driverPulseIcon = L.divIcon({ className: 'driver-pulse', html: '', iconSize: [12,12] as any });

const DriverAnimator: React.FC<{ target?: DriverPosition | null }> = ({ target }) => {
  const map = useMap();
  const [pos, setPos] = useState<{ lat:number; lng:number; heading?:number }|null>(target? { lat: target.lat, lng: target.lng, heading: target.heading } : null);
  const animRef = useRef<number|undefined>(undefined);
  const lastRef = useRef<{ lat:number; lng:number; at:number }|null>(target? { lat: target.lat, lng: target.lng, at: target.ts||Date.now() } : null);

  useEffect(() => {
    if (!target) return;
    const from = lastRef.current || { lat: target.lat, lng: target.lng, at: Date.now() };
    const to = { lat: target.lat, lng: target.lng };
    const start = performance.now();
    const dur = 300;
    function step(now:number) {
      const t = Math.min(1, (now - start) / dur);
      const e = ease(t);
      const lat = from.lat + (to.lat - from.lat) * e;
      const lng = from.lng + (to.lng - from.lng) * e;
      setPos({ lat, lng, heading: target ? target.heading : undefined });
      if (t < 1) animRef.current = requestAnimationFrame(step);
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);
    lastRef.current = { lat: target.lat, lng: target.lng, at: target.ts||Date.now() };
    // Gentle auto-pan if driver leaves viewport, keep calm otherwise
    try {
      const bounds = map.getBounds();
      if (!bounds.contains([target.lat, target.lng])) {
        map.panTo([target.lat, target.lng], { animate: true });
      }
    } catch {}
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target?.lat, target?.lng]);

  if (!pos) return null;
  return <Marker position={[pos.lat, pos.lng]} icon={driverPulseIcon as any} />;
};

export const RideLiveMap: React.FC<{ ride: RideLike; driver?: DriverPosition | null; height?: number }>
  = ({ ride, driver, height = 240 }) => {
  const pickup = extractLatLng(ride?.pickup);
  const dropoff = extractLatLng(ride?.dropoff);

  const center = useMemo(() => {
    if (driver) return [driver.lat, driver.lng] as [number, number];
    if (pickup) return [pickup.lat, pickup.lng] as [number, number];
    if (dropoff) return [dropoff.lat, dropoff.lng] as [number, number];
    // Default to Lagos, Nigeria if unknown
    return [6.5244, 3.3792] as [number, number];
  }, [driver, pickup, dropoff]);

  return (
    <div style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }} aria-label="Live ride map">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        {pickup && <Marker position={[pickup.lat, pickup.lng]} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} />}
        {driver && <DriverAnimator target={driver} />}
      </MapContainer>
    </div>
  );
};

export default RideLiveMap;
