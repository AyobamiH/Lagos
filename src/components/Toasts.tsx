import React from 'react';
import { useToast } from '../context/ToastContext';
export const Toasts: React.FC = () => {
  const { toasts, dismiss } = useToast();
  return (
    <div aria-live="polite" aria-relevant="additions" style={{position:'fixed', top:8, right:8, display:'grid', gap:8, zIndex:9999}}>
      {toasts.map(t => (
        <div key={t.id} style={{background:'#222', color:'#fff', padding:'8px 12px', borderLeft:`4px solid ${t.type==='error'?'#d32f2f':t.type==='success'?'#2e7d32':'#1976d2'}`, borderRadius:4, minWidth:240}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <strong style={{fontSize:12, textTransform:'uppercase'}}>{t.type}</strong>
            <button onClick={()=>dismiss(t.id)} style={{background:'transparent', color:'#fff', border:'none', cursor:'pointer'}}>×</button>
          </div>
          <div style={{fontSize:13}}>{t.message}</div>
        </div>
      ))}
    </div>
  );
};
