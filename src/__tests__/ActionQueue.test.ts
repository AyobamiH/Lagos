import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueRideRequest, enqueueFeedback, enqueueDriverLocation, enqueueDriverLifecycle, processAll, clearAll, snapshotQueue } from '../offline/ActionQueue';

function flushTimers(ms:number){ return new Promise(r=>setTimeout(r, ms)); }

describe('ActionQueue resilience', () => {
  beforeEach(()=>{ clearAll(); });

  it('dedupes identical ride requests', () => {
    const p = { pickup:{lat:1,lng:2}, dropoff:{lat:3,lng:4}, productType:'standard' };
    const id1 = enqueueRideRequest(p);
    const id2 = enqueueRideRequest(p); // duplicate
    expect(id1).toBeTruthy();
    expect(id2).toBeNull();
    expect(snapshotQueue().length).toBe(1);
  });

  it('applies exponential backoff on failures and respects nextEligibleAt', async () => {
    const p = { pickup:{lat:1,lng:2}, dropoff:{lat:3,lng:4}, productType:'standard' };
    enqueueRideRequest(p);
    let callCount = 0;
    const deps = {
      submitFeedback: async () => {},
      requestRide: async () => { callCount++; throw { friendlyMessage:'fail' }; },
      isRateLimited: () => false
    };
    // First processing attempt -> failure sets nextEligibleAt
    await processAll(deps as any);
    const q1 = snapshotQueue()[0];
    expect(q1.attempts).toBe(1);
    const firstEta = q1.nextEligibleAt!;
    // Immediately process again; should skip due to nextEligibleAt
    await processAll(deps as any);
    const q2 = snapshotQueue()[0];
    expect(q2.attempts).toBe(1); // unchanged
    // Fast-forward by manipulating nextEligibleAt to past then process
    (q2 as any).nextEligibleAt = Date.now() - 10;
    await processAll(deps as any);
    expect(snapshotQueue()[0].attempts).toBe(2);
    expect(callCount).toBe(2);
    expect(snapshotQueue()[0].nextEligibleAt).toBeGreaterThan(firstEta); // backoff grew
  });

  it('skips processing when rate limited and preserves attempts', async () => {
    enqueueFeedback({ message:'hello world' });
    let attempted = false;
    const deps = {
      submitFeedback: async () => { attempted = true; },
      requestRide: async () => {},
      sendDriverLocation: async () => {},
      isRateLimited: () => true
    };
    await processAll(deps as any);
    expect(attempted).toBe(false);
    expect(snapshotQueue()[0].attempts).toBe(0);
  });

  it('dedupes identical driver location pings', () => {
    const id1 = enqueueDriverLocation({ lat:10.123456, lng:20.123456 });
    const id2 = enqueueDriverLocation({ lat:10.123456, lng:20.123456 });
    expect(id1).toBeTruthy();
    expect(id2).toBeNull();
    expect(snapshotQueue().length).toBe(1);
  });

  it('processes driver location ping and applies backoff on failure', async () => {
    enqueueDriverLocation({ lat:1, lng:2 });
    let locCalls = 0;
    const failingDeps = {
      submitFeedback: async () => {},
      requestRide: async () => {},
      sendDriverLocation: async () => { locCalls++; throw { friendlyMessage:'loc_fail' }; },
      isRateLimited: () => false
    };
    await processAll(failingDeps as any);
    const q = snapshotQueue()[0];
    expect(q.kind).toBe('driver_location_ping');
    expect(q.attempts).toBe(1);
    expect(q.nextEligibleAt).toBeGreaterThan(Date.now());
    // Force eligibility and process again to increment attempts
    (q as any).nextEligibleAt = Date.now() - 1;
    await processAll(failingDeps as any);
    expect(snapshotQueue()[0].attempts).toBe(2);
    // Now succeed
    (snapshotQueue()[0] as any).nextEligibleAt = Date.now() - 1;
    const successDeps = {
      submitFeedback: async () => {},
      requestRide: async () => {},
      sendDriverLocation: async () => { locCalls++; },
      isRateLimited: () => false
    };
    await processAll(successDeps as any);
    expect(snapshotQueue().length).toBe(0);
    expect(locCalls).toBe(3); // two fails + one success
  });

  it('dedupes identical driver lifecycle actions', () => {
    const id1 = enqueueDriverLifecycle({ rideId:'r1', op:'arrive' });
    const id2 = enqueueDriverLifecycle({ rideId:'r1', op:'arrive' });
    expect(id1).toBeTruthy();
    expect(id2).toBeNull();
    expect(snapshotQueue().length).toBe(1);
  });

  it('processes driver lifecycle with retry backoff on failure then succeeds', async () => {
    enqueueDriverLifecycle({ rideId:'r42', op:'start' });
    let lifecycleCalls = 0;
    const failingDeps = {
      submitFeedback: async () => {},
      requestRide: async () => {},
      sendDriverLocation: async () => {},
      driverLifecycle: async () => { lifecycleCalls++; throw { friendlyMessage:'lifecycle_fail' }; },
      isRateLimited: () => false
    } as any;
    await processAll(failingDeps);
    const q = snapshotQueue()[0];
    expect(q.kind).toBe('driver_lifecycle');
    expect(q.attempts).toBe(1);
    (q as any).nextEligibleAt = Date.now() - 1;
    await processAll(failingDeps);
    expect(snapshotQueue()[0].attempts).toBe(2);
    (snapshotQueue()[0] as any).nextEligibleAt = Date.now() - 1;
    const successDeps = {
      submitFeedback: async () => {},
      requestRide: async () => {},
      sendDriverLocation: async () => {},
      driverLifecycle: async () => { lifecycleCalls++; },
      isRateLimited: () => false
    } as any;
    await processAll(successDeps);
    expect(snapshotQueue().length).toBe(0);
    expect(lifecycleCalls).toBe(3); // two fails + one success
  });

  it('drops terminal validation_failed errors (no retry)', async () => {
    enqueueFeedback({ message:'bad' });
    const deps = {
      submitFeedback: async () => { throw { code:'validation_failed', status:400, friendlyMessage:'invalid' }; },
      requestRide: async () => {},
      sendDriverLocation: async () => {},
      driverLifecycle: async () => {},
      isRateLimited: () => false
    } as any;
    await processAll(deps);
    // Should be removed (dropped) because terminal
    expect(snapshotQueue().length).toBe(0);
  });
});
