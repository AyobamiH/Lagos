import React, { createContext, useContext, useRef } from 'react';
import { request as baseRequest } from '../api/client';

interface ReqMeta { id: string; started: number; path: string; }
interface RequestCtx {
  newCorrelationId: (path: string) => string;
  request: (path: string, init?: RequestInit) => Promise<any>;
}
const Ctx = createContext<RequestCtx>(null as any);

function generateId() { return Math.random().toString(36).slice(2,10); }

export const RequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const active = useRef<Record<string, ReqMeta>>({});
  function newCorrelationId(path: string) {
    const id = generateId();
    active.current[id] = { id, started: Date.now(), path };
    return id;
  }
  async function wrapped(path: string, init: RequestInit = {}) {
    const cid = newCorrelationId(path);
    try {
      const res = await baseRequest(path, { ...init, headers:{ ...(init.headers||{}), 'X-Correlation-ID': cid } });
      return res;
    } catch (e: any) {
      (e as any).correlationId = cid;
      throw e;
    } finally { delete active.current[cid]; }
  }
  return <Ctx.Provider value={{ newCorrelationId, request: wrapped }}>{children}</Ctx.Provider>;
};

export function useRequestCtx() { return useContext(Ctx); }
