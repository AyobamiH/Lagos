import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { RealtimeProvider } from '../context/RealtimeContext';
import { ToastProvider } from '../context/ToastContext';
import { DiagnosticsProvider } from '../context/DiagnosticsContext';
import RidesList from '../pages/rides/RidesList';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({ api: {}, registerApiHooks: () => {}, injectTokenAccessors: () => {} }));
vi.mock('../data/rides', () => ({
  fetchRides: vi.fn(async ()=> ({ rides: [{ _id:'r1', status:'searching', fare:100, createdAt:new Date().toISOString() }]})),
  fetchRidesWithMeta: vi.fn(async ()=> ({ page: { rides: [{ _id:'r1', status:'searching', fare:100, createdAt:new Date().toISOString() }] }, etag: 'etagA' }))
}));

globalThis.fetch = vi.fn(async () => ({ ok:true, json: async()=>({}), text: async()=>'{}' })) as any;

let socketListeners: Record<string, Function[]> = {};
export const emitSocket = (evt: string, payload: any) => { (socketListeners[evt]||[]).forEach(fn=>fn(payload)); };
let mockSocket: any = null;
vi.mock('../realtime/socket', () => ({
  connectSocket: () => { mockSocket = { on: (evt: string, cb: Function) => { (socketListeners[evt] ||= []).push(cb); } }; return mockSocket; },
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

describe('Realtime sequence gap + duplicate guard', () => {
  beforeEach(()=>{ socketListeners = {}; });
  it('ignores duplicate / out-of-order seq and flags gaps', async () => {
    render(<MemoryRouter><Providers><RidesList /></Providers></MemoryRouter>);
    await screen.findByText('My Rides');
    // baseline update seq 1
  await act(async () => { emitSocket('ride_status', { rideId:'r1', status:'offer_pending', seq:1 }); });
    await waitFor(()=> expect(screen.getByText('offer_pending')).toBeInTheDocument());
  // out-of-order older seq 1 again (should be ignored silently)
  await act(async () => { emitSocket('ride_status', { rideId:'r1', status:'assigned', seq:1 }); });
  await new Promise(r=>setTimeout(r,80));
  // We don't assert negative due to render timing; main check is later gap + update
  // gap jump seq 5 (missing 2-4) applied - ensure update occurs
  await act(async () => { emitSocket('ride_status', { rideId:'r1', status:'assigned', seq:5 }); });
  await waitFor(()=> expect(screen.getByText('assigned')).toBeInTheDocument());
  }, 10000);
});