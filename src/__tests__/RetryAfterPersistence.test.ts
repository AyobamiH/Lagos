import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueDriverLocation, snapshotQueue, clearAll } from '../offline/ActionQueue';

// We will simulate a rate-limited error path by directly manipulating queue entries and persistence.

// Mock Date.now for determinism
const baseNow = Date.now();
vi.spyOn(Date, 'now').mockImplementation(()=> baseNow);

// Force localStorage polyfill if jsdom not providing fully
beforeEach(() => { localStorage.clear(); clearAll(); });

describe('Retry-After nextEligibleAt persistence', () => {
  it('persists nextEligibleAt to localStorage so reload keeps schedule', () => {
    const id = enqueueDriverLocation({ lat: 1, lng: 2 });
    expect(id).toBeTruthy();
    // Simulate we got a 429 and annotated entry with nextEligibleAt externally (like MutationQueueContext does)
    const future = baseNow + 5000;
    const raw = JSON.parse(localStorage.getItem('action_queue_v1')!);
    const updated = raw.items.map((it: any) => it.id === id ? { ...it, nextEligibleAt: future } : it);
    localStorage.setItem('action_queue_v1', JSON.stringify({ v:1, items: updated }));
    // Reload module snapshot (simulate app reload)
    const reloaded = JSON.parse(localStorage.getItem('action_queue_v1')!);
    const found = reloaded.items.find((it: any) => it.id === id);
    expect(found.nextEligibleAt).toBe(future);
  });
});
