// Minimal Leaflet type surfaces we rely on
declare module 'leaflet' {
	export interface LatLng { lat: number; lng: number; }
	export interface LeafletMouseEvent { latlng: LatLng }
	export namespace Icon { class Default { static prototype: any; static mergeOptions(opts: any): void; } }
	const L: any;
	export default L;
}

declare module 'react-leaflet' {
	import * as React from 'react';
	import { LatLng } from 'leaflet';
	export interface MapContainerProps {
		center: [number, number];
		zoom?: number;
		style?: React.CSSProperties;
		scrollWheelZoom?: boolean;
		children?: React.ReactNode;
		whenCreated?: (map: any) => void;
	}
	export const MapContainer: React.FC<MapContainerProps>;
	export const TileLayer: React.FC<{ url: string; attribution?: string }>;
	export const Marker: React.FC<{ position: [number, number]; icon?: any; draggable?: boolean; eventHandlers?: Record<string, (e:any)=>void>; children?: React.ReactNode }>;
	export const Popup: React.FC<{ children?: React.ReactNode }>;
	export const GeoJSON: React.FC<{ data: any; style?: (feature: any)=>any }>;
	export function useMapEvents(handlers: Record<string, (e: any)=>void>): any;
	export function useMap(): any;
}
