import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { RealtimeProvider } from '../context/RealtimeContext';
import { ToastProvider } from '../context/ToastContext';
import { DiagnosticsProvider } from '../context/DiagnosticsContext';
import RidesList from '../pages/rides/RidesList';
import { MemoryRouter } from 'react-router-dom';

// Mock API client hooks (noop)
vi.mock('../api/client', () => ({ api: { ridesPage: vi.fn(async (token: string, cursor?: string) => cursor ? ({ rides:[{ _id:'r3', status:'completed', fare:900, createdAt:new Date().toISOString() }], nextCursor:null }) : ({ rides:[{ _id:'r1', status:'requested', fare:1000, createdAt:new Date().toISOString() },{ _id:'r2', status:'assigned', fare:1200, createdAt:new Date().toISOString() }], nextCursor:'c2' }) ) }, registerApiHooks: () => {}, injectTokenAccessors: () => {} }));
// Mock rides data module
vi.mock('../data/rides', () => ({
  fetchRides: vi.fn(async (token: string, cursor?: string) => cursor ? ({ ...ridesPage2 }) : ({ ...ridesPage1 })),
  fetchRidesWithMeta: vi.fn(async (token: string, cursor?: string|null) => cursor ? ({ page: { ...ridesPage2 }, etag: 'etag2' }) : ({ page: { ...ridesPage1 }, etag: 'etag1' }))
}));

const ridesPage1 = { rides: [
  { _id: 'r1', status: 'requested', fare: 1000, createdAt: new Date().toISOString() },
  { _id: 'r2', status: 'assigned', fare: 1200, createdAt: new Date().toISOString() }
], nextCursor: 'c2' };
const ridesPage2 = { rides: [ { _id: 'r3', status: 'completed', fare: 900, createdAt: new Date().toISOString() } ] };

// Minimal fetch fallback for other calls
globalThis.fetch = vi.fn(async () => ({ ok:true, json: async()=>({}), text: async()=>"{}" })) as any;

// Mock socket module to inject realtime updates
let socketListeners: Record<string, Function[]> = {};
export const emitSocket = (evt: string, payload: any) => { (socketListeners[evt]||[]).forEach(fn=>fn(payload)); };
let mockSocket: any = null;
vi.mock('../realtime/socket', () => ({
  connectSocket: () => {
    mockSocket = { on: (evt: string, cb: Function) => { (socketListeners[evt] ||= []).push(cb); } };
    return mockSocket;
  },
  getSocket: () => mockSocket,
  disconnectSocket: () => { mockSocket = null; },
  wasRecentlyTried: () => true
}));

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <AuthProvider initialToken="t">
      <DiagnosticsProvider>
        <RealtimeProvider>{children}</RealtimeProvider>
      </DiagnosticsProvider>
    </AuthProvider>
  </ToastProvider>
);

describe('Rides list pagination + realtime merge', () => {
  beforeEach(()=>{ socketListeners = {}; (fetch as any).mockClear && (fetch as any).mockClear(); });
  it('loads pages and merges realtime update', async () => {
  render(<MemoryRouter><Providers><RidesList /></Providers></MemoryRouter>);
  await screen.findByText('My Rides');
  await waitFor(()=> expect(screen.getAllByTestId('ride-item').length).toBe(2));
    // Emit realtime status change for r1
  await act(async () => { emitSocket('ride_status', { rideId: 'r1', status: 'driver_en_route' }); });
    await waitFor(()=> expect(screen.getByText('driver_en_route')).toBeInTheDocument());
    // Load more (second page)
    fireEvent.click(screen.getByRole('button', { name: /Load More/i }));
    await waitFor(()=> expect(screen.getByText('completed')).toBeInTheDocument());
  }, 15000);
});
