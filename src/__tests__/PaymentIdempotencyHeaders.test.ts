import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api } from '../api/client';

const originalFetch = globalThis.fetch;
let calls: any[] = [];

// Patch request signature adaptation depending on implementation

describe('Payment Idempotency Header Integration', () => {
  beforeEach(() => {
    calls = [];
  globalThis.fetch = (async (url: RequestInfo, init?: RequestInit) => {
      calls.push({ url, init });
      const body = JSON.stringify({ paymentId:'p1', status:'initiated', amount: 1000, currency:'USD' });
      return new Response(body, { status:201, headers:{ 'Content-Type':'application/json' } });
    }) as any;
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('sets Idempotency-Key on initiate, capture, refund (auto-generated)', async () => {
    await api.paymentInitiate('tok', { rideId:'r1', method:'card', amount:1000, currency:'USD' });
    await api.paymentCapture('tok', 'p1', 500);
    await api.paymentRefund('tok', 'p1', 200);
    const headersList = calls.map(c => c.init?.headers as Record<string,string>);
    const keys = headersList.map(h => h['Idempotency-Key']);
    expect(keys.length).toBe(3);
    keys.forEach(k => expect(k).toBeTruthy());
    expect(new Set(keys).size).toBe(3); // all unique
  });
});
