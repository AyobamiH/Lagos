import React, { createContext, useContext, useEffect, useState } from 'react';

interface RateLimitState {
  active: boolean;
  retryAt: number | null;
  secondsLeft: number;
  trigger: (retryAfterMs: number) => void;
  clear: () => void;
}

const Ctx = createContext<RateLimitState>(null as any);

export const RateLimitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [retryAt, setRetryAt] = useState<number|null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  function trigger(retryAfterMs: number) {
    const target = Date.now() + retryAfterMs;
    setRetryAt(target);
  }
  function clear() { setRetryAt(null); setSecondsLeft(0); }

  useEffect(() => {
    if (!retryAt) return;
    const id = setInterval(() => {
      const leftMs = retryAt - Date.now();
      if (leftMs <= 0) { clear(); } else setSecondsLeft(Math.ceil(leftMs/1000));
    }, 500);
    return () => clearInterval(id);
  }, [retryAt]);

  return <Ctx.Provider value={{ active: !!retryAt, retryAt, secondsLeft, trigger, clear }}>{children}</Ctx.Provider>;
};

export function useRateLimit() { return useContext(Ctx); }