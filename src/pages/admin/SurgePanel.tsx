import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const SurgePanel: React.FC = () => {
  const { token } = useAuth();
  const [versions, setVersions] = useState<any[]>([]);
  const [baseMultiplier, setBaseMultiplier] = useState('1.0');
  const [notes, setNotes] = useState('');
  async function load() { if (!token) return; try { const v = await api.surgeListVersions(token); setVersions(v); } catch {} }
  useEffect(()=>{ load(); }, [token]);
  if (!token) return <p>Auth required</p>;
  return (
    <div style={{display:'grid', gap:12}}>
      <h2>Surge Versions</h2>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <input value={baseMultiplier} onChange={e=>setBaseMultiplier(e.target.value)} style={{width:90}} />
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes" />
        <button onClick={async ()=>{ try { await api.surgeUpsertVersion(token!, { baseMultiplier: parseFloat(baseMultiplier)||1, notes }); setNotes(''); load(); } catch {} }}>Upsert</button>
      </div>
      <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:6}}>
        {versions.map((v:any,i:number)=>(<li key={i} style={{background:'#f1f5f9', padding:6, borderRadius:4, fontSize:12}}>
          v{v.version ?? '?'} · base:{v.baseMultiplier} {v.active && <strong>ACTIVE</strong>} {v.notes && <em>{v.notes}</em>}
        </li>))}
      </ul>
    </div>
  );
};
