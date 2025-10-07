import React, { useEffect, useState } from 'react';
interface DeadItem { id:string; kind:string; reasonDropped?:string; lastError?:string; createdAt:number; attempts:number; }

export const DeadLetterPanel: React.FC = () => {
  const [items, setItems] = useState<DeadItem[]>([]);
  useEffect(() => {
    function handler(e: any) {
      const it = e?.detail?.item; if (!it) return;
      setItems(prev => [ { id: it.id, kind: it.kind, reasonDropped: it.reasonDropped, lastError: it.lastError, createdAt: it.createdAt, attempts: it.attempts }, ...prev].slice(0,50));
    }
    window.addEventListener('actionQueue:deadLetter', handler as any);
    return () => window.removeEventListener('actionQueue:deadLetter', handler as any);
  }, []);
  if (!items.length) return null;
  return (
    <div style={{position:'fixed', bottom:8, right:8, background:'#1e293b', color:'#fff', padding:8, borderRadius:6, maxWidth:320, fontSize:11, boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
      <strong style={{fontSize:12}}>Dead-Letter ({items.length})</strong>
      <ul style={{listStyle:'none', margin:0, padding:0, display:'grid', gap:4, maxHeight:160, overflow:'auto'}}>
        {items.map(i => (
          <li key={i.id} style={{background:'#334155', padding:4, borderRadius:4}}>
            <div><code>{i.kind}</code> {i.reasonDropped||i.lastError}</div>
            <div style={{opacity:0.7}}>{new Date(i.createdAt).toLocaleTimeString()} · a:{i.attempts}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};
