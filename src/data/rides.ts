import { api, getLastResponseHeaders } from '../api/client';
import { RidesPage } from '../api/schemas';

// Backward-compatible function (tests expect this shape)
export async function fetchRides(token: string, cursor?: string | null, status?: string): Promise<RidesPage> {
  return api.ridesPage(token, cursor || undefined, status);
}

export interface FetchedRidesResult { page?: RidesPage; notModified?: boolean; etag?: string|null; }

export async function fetchRidesWithMeta(token: string, cursor?: string | null, status?: string, etag?: string|null): Promise<FetchedRidesResult> {
  const result = await api.ridesPage(token, cursor || undefined, status, etag || undefined as any);
  if ((result as any)?.__notModified) {
    const hdrs = getLastResponseHeaders();
    return { notModified: true, etag: hdrs.etag || null };
  }
  const hdrs = getLastResponseHeaders();
  return { page: result as any, notModified: false, etag: hdrs.etag || null };
}