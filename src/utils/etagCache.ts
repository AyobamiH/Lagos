import { ETagCacheEntry } from '../types/domain';

// Simple in-memory ETag cache; can be swapped for more robust solution later.
class ETagCache {
  private store = new Map<string, ETagCacheEntry<any>>();
  get<T>(key: string): ETagCacheEntry<T> | undefined { return this.store.get(key); }
  set<T>(key: string, entry: ETagCacheEntry<T>) { this.store.set(key, entry); }
  invalidate(prefix?: string) {
    if (!prefix) { this.store.clear(); return; }
    for (const k of [...this.store.keys()]) if (k.startsWith(prefix)) this.store.delete(k);
  }
}
export const etagCache = new ETagCache();

export function withConditionalHeaders(key: string, init: RequestInit = {}): RequestInit {
  const existing = etagCache.get<any>(key);
  if (existing) {
    init.headers = { ...(init.headers||{}), 'If-None-Match': existing.etag } as any;
  }
  return init;
}

export async function fetchWithETag<T>(key: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, withConditionalHeaders(key, init));
  if (res.status === 304) {
    const cached = etagCache.get<T>(key);
    if (!cached) throw new Error('Cache miss on 304 for '+key);
    return cached.value;
  }
  const etag = res.headers.get('ETag');
  const json = await res.json();
  if (etag) etagCache.set(key, { etag, value: json, updatedAt: Date.now() });
  return json;
}
