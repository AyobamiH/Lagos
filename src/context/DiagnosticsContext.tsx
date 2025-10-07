import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE, api } from '../api/client';
import { useAuth } from './AuthContext';

interface DiagnosticsState {
  latency: number | null;
  lastFetched: number | null;
  data: any | null;
  fetching: boolean;
  fetchNow: () => void;
}

const Ctx = createContext<DiagnosticsState>(null as any);

export const DiagnosticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [data, setData] = useState<any|null>(null);
  const [fetching, setFetching] = useState(false);
  const [latency, setLatency] = useState<number|null>(null);
  const [lastFetched, setLastFetched] = useState<number|null>(null);

  const enabled = import.meta.env.VITE_ENABLE_DIAGNOSTICS === 'true';
  async function fetchNow() {
    if (!token || !enabled) return;
    setFetching(true);
    const start = performance.now();
    try {
  const json = await api.diagnostics(token);
  setData(json);
    } catch { /* ignore */ }
    setLatency(Math.round(performance.now() - start));
    setLastFetched(Date.now());
    setFetching(false);
  }

  useEffect(() => {
    if (token && enabled) fetchNow();
    const id = setInterval(()=>{ if (token && enabled) fetchNow(); }, 15000);
    return () => clearInterval(id);
  }, [token]);

  return <Ctx.Provider value={{ latency, lastFetched, data, fetching, fetchNow }}>{children}</Ctx.Provider>;
};

export const useDiagnostics = () => useContext(Ctx);
