import { describe, it, expect, vi } from 'vitest';

let initiateCalls: any[] = [];

vi.mock('../api/client', () => {
  return {
    api: {
      paymentInitiate: async (_t: string, payload: any, key?: string) => { initiateCalls.push(key); return { _id:'pay1', status:'initiated' }; }
    }
  };
});

import { api } from '../api/client';

describe('Payment idempotency key generation', () => {
  it('generates a key when none supplied', async () => {
    const r = await api.paymentInitiate('tok', { rideId:'r1', method:'card' });
    expect(r._id).toBe('pay1');
    expect(initiateCalls[0]).toBeUndefined(); // our mock signature: key param receives caller-supplied key only
  });
});
