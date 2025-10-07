import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RideDetail from '../pages/rides/RideDetail';

// Minimal mocks for contexts consumed by RideDetail
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: 't', profile: { _id:'u1' } }) }));
vi.mock('../api/client', () => ({
  api: {
    rideDetail: async () => ({ _id:'r1', status:'searching', eta: 7, createdAt: new Date().toISOString(), fare: 1200 }),
    patchRide: async () => ({ _id:'r1', status:'searching', eta: 5, createdAt: new Date().toISOString(), fare: 1200 })
  },
  getLastResponseHeaders: () => ({}),
  request: async () => ({}),
  classifyError: () => ({})
}));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => ({ updates:{}, lastUpdates:{}, subscribe: () => {}, connected:true, reconnect:()=>{} }) }));
vi.mock('../context/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ flags:{} }) }));

// Provide a MemoryRouter wrapper if RideDetail expects route params (simulate :id)
import { MemoryRouter, Route, Routes } from 'react-router-dom';

function Wrapper() {
  return (
    <MemoryRouter initialEntries={["/rides/r1"]}>
      <Routes>
        <Route path="/rides/:id" element={<RideDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RideDetail ETA normalization', () => {
  it('maps backend eta to etaMinutes', async () => {
    render(<Wrapper />);
  const matches = await screen.findAllByText((_, el) => /ETA:\s*7\s*m/i.test(el?.textContent || ''));
  expect(matches.length).toBeGreaterThan(0);
  expect(matches[0].textContent).toMatch(/ETA:\s*7\s*m/i);
  });
});
