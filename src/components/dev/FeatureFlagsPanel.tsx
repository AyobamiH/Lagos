import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const FeatureFlagsPanel: React.FC = () => {
  const { token } = useAuth();
  const [flags, setFlags] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);
  useEffect(()=>{ (async ()=>{ if (!token) return; try { const f = await api.featureFlags(token); setFlags(f); } catch{} })(); }, [token]);
  if (!token) return null;
  return (
    <div className="fixed bottom-2 right-2 text-xs z-40">
      <button onClick={()=>setOpen(o=>!o)} className="px-2 py-1 rounded bg-slate-800 text-white shadow">Flags</button>
      {open && (
        <div className="mt-2 max-h-64 overflow-auto p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow w-60 space-y-1">
          {Object.keys(flags).length===0 && <p className="text-[10px] opacity-60">No flags</p>}
          {Object.entries(flags).map(([k,v]) => (
            <div key={k} className="flex justify-between gap-2"><span className="truncate" title={k}>{k}</span><span className="font-medium">{String(v)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
};
