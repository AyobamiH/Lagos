import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE, api } from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface FlagsState {
  flags: Record<string, any>;
  loading: boolean;
  reload: () => void;
  isEnabled: (key: string) => boolean;
}

const Ctx = createContext<FlagsState>(null as any);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const { token, profile } = useAuth();
  const { push } = useToast();

  async function load() {
    if (!token) return; // require auth (internalAuth might require header; if backend expects key, this will just 401 gracefully)
    setLoading(true);
    try {
  const json = await api.featureFlags(token);
  setFlags(json || {});
    } catch(e:any) { if (e?.status !== 401) push({ message: 'Failed to load feature flags', type:'error' }); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [token]);

  function isEnabled(key: string) {
    const v = flags[key];
    if (!v) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v?.enabled === 'boolean') return !!v.enabled;
    return false;
  }

  return <Ctx.Provider value={{ flags, loading, reload: load, isEnabled }}>{children}</Ctx.Provider>;
};

export function useFeatureFlags() { return useContext(Ctx); }