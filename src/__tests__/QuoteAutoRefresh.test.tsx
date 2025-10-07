import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuoteAndRequest from '../pages/rides/QuoteAndRequest';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: 'tok' }) }));
vi.mock('../rum/clientRUM', () => ({ recordAction: () => {} }));

let quoteCalls = 0;
let rideCalls = 0;

vi.mock('../api/client', () => {
  return {
    api: {
      getQuote: async () => { quoteCalls++; return { total: 1000, surgeMultiplier: 1.2, expiresAt: new Date(Date.now() + 1000).toISOString(), payload: { a:1 }, signature: 'sig', quoteId:'qid1' }; },
      rideRequest: async (_t: string, body: any) => { rideCalls++; if (rideCalls === 1) { const err: any = new Error('expired'); err.code='expired_quote'; throw err; } return { ride: { _id:'r1' } }; }
    }
  };
});

import { MemoryRouter } from 'react-router-dom';

describe('Quote auto-refresh on quote errors', () => {
  it('re-fetches quote when expired_quote triggers ride request', async () => {
    render(<MemoryRouter><QuoteAndRequest /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Fetch fare quote/i }));
  await screen.findByText(/Quote/);
  // Accessible name is from aria-label attribute
  fireEvent.click(screen.getByRole('button', { name: /Request ride with this quote/i }));
    await waitFor(()=> expect(quoteCalls).toBeGreaterThan(1));
  });
});
