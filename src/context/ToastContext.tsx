import React, { createContext, useContext, useCallback, useState } from 'react';
export interface Toast { id: string; message: string; type?: 'info'|'error'|'success'; ttl?: number }
interface ToastApi { toasts: Toast[]; push: (m: Omit<Toast,'id'>) => void; dismiss: (id: string) => void; }
// Provide a safe default so that accidental usage outside a provider does not crash the tree.
const defaultApi: ToastApi = { toasts: [], push: (m) => { console.warn('[toast] used outside provider - noop', m); }, dismiss: () => {} };
const Ctx = createContext<ToastApi>(defaultApi as ToastApi);
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts(t => t.filter(x=>x.id!==id)), []);
  const push = useCallback((m: Omit<Toast,'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, type: 'info', ttl: 5000, ...m };
    setToasts(t => [toast, ...t]);
  if (toast.ttl) setTimeout(()=>dismiss(id), toast.ttl);
  }, [dismiss]);
  return <Ctx.Provider value={{ toasts, push, dismiss }}>{children}</Ctx.Provider>;
};
export const useToast = () => useContext(Ctx);
