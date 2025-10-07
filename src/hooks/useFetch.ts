import { useEffect, useRef, useState } from 'react';
import { request } from '../api/client';
import type { ZodSchema } from 'zod';

interface UseFetchOptions<T> {
  // URL relative to API base OR absolute (if starts with http)
  url: string;
  method?: string;
  body?: any;
  deps?: any[]; // triggers refetch when changed
  schema?: ZodSchema<T>;
  skip?: boolean;
  headers?: Record<string,string>;
}

interface UseFetchReturn<T> {
  data: T | null;
  error: any;
  loading: boolean;
  refetch: () => void;
  aborted: boolean;
}

let reqSeq = 0;

export function useFetch<T = any>(opts: UseFetchOptions<T>): UseFetchReturn<T> {
  const { url, method = 'GET', body, deps = [], schema, skip, headers } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [aborted, setAborted] = useState(false);
  const forceRef = useRef(0);

  function refetch() { forceRef.current++; }

  useEffect(() => {
    if (skip) return;
    const thisReq = ++reqSeq;
    const ctrl = new AbortController();
    setLoading(true); setError(null); setAborted(false);

    async function run() {
      try {
        // Use central api.request if relative; fallback to fetch for absolute.
  let json: any;
        if (/^https?:/i.test(url)) {
          const res = await fetch(url, { method, headers: { 'Content-Type':'application/json', ...(headers||{}) }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
          json = await res.json().catch(()=>null);
          if (!res.ok) throw json || { error: 'http_error', status: res.status };
        } else {
          json = await request(url.startsWith('/') ? url : `/${url}`, { method, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
        }
        if (schema) {
          const parsed = schema.safeParse(json);
          if (!parsed.success) throw { error: 'schema_validation_failed', issues: parsed.error.issues };
          json = parsed.data;
        }
        // Stale guard: ignore if newer request started
        if (thisReq !== reqSeq) return;
        setData(json);
      } catch (e: any) {
        if (ctrl.signal.aborted) { setAborted(true); return; }
        if (thisReq !== reqSeq) return; // stale
        setError(e);
      } finally {
        if (thisReq === reqSeq) setLoading(false);
      }
    }
    run();
    return () => { ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, JSON.stringify(body), skip, ...deps, forceRef.current]);

  return { data, error, loading, refetch, aborted };
}
