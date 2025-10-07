import React, { createContext, useContext, useRef } from 'react';
import { useRateLimit } from './RateLimitContext';
import { useToast } from './ToastContext';

interface QueuedAction { id: string; run: () => Promise<any>; label?: string; }
interface RLQState { enqueue: (fn: () => Promise<any>, label?: string) => void; pending: number; }

const Ctx = createContext<RLQState>(null as any);

export const RateLimitQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qRef = useRef<QueuedAction[]>([]);
  const running = useRef(false);
  const { active, secondsLeft } = useRateLimit();
  const { push } = useToast();

  async function drain() {
    if (running.current) return; running.current = true;
    while (qRef.current.length) {
      const job = qRef.current.shift()!;
      try { await job.run(); push({ message:`Retried: ${job.label || job.id}`, type:'success' }); } catch(e:any) { push({ message:`Retry failed: ${job.label||job.id}`, type:'error' }); }
      if (active) break; // stop if rate limit resumed again mid-drain
    }
    running.current = false;
  }

  React.useEffect(() => { if (!active && qRef.current.length) drain(); }, [active, secondsLeft]);

  function enqueue(run: () => Promise<any>, label?: string) {
    qRef.current.push({ id: 'rlq_'+Date.now(), run, label });
    if (!active) drain(); else push({ message:`Queued: ${label || 'action'}`, type:'info' });
  }

  return <Ctx.Provider value={{ enqueue, pending: qRef.current.length }}>{children}</Ctx.Provider>;
};

export function useRateLimitQueue() { return useContext(Ctx); }
