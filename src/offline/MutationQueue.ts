// Simple in-memory + localStorage-backed mutation queue for offline feedback submissions
import { api } from '../api/client';

interface QueuedMutation { id: string; type: 'feedback_submit'; payload: any; retryAfter?: number; }
const STORAGE_KEY = 'queued_mutations_v1';

function load(): QueuedMutation[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw? JSON.parse(raw):[]; } catch { return []; }
}
function save(list: QueuedMutation[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {} }

let queue: QueuedMutation[] = load();

export function enqueueFeedback(message: string) {
  const item: QueuedMutation = { id: 'qf_'+Date.now(), type:'feedback_submit', payload:{ message } };
  queue.push(item); save(queue);
}

export async function processQueue(token: string) {
  const remaining: QueuedMutation[] = [];
  for (const item of queue) {
    if (item.type === 'feedback_submit') {
      try { await api.submitFeedback(token, item.payload.message); } catch { remaining.push(item); }
    }
  }
  queue = remaining; save(queue);
}

export function hasQueue() { return queue.length > 0; }
