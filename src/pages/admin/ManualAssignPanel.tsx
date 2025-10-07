import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

export const ManualAssignPanel: React.FC = () => {
  const { token, hasScope } = useAuth();
  const [rideId, setRideId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [result, setResult] = useState<any>(null);
  if (!token) return <p>Auth required</p>;
  if (!hasScope('ride:assign:manual')) return <p>Insufficient permissions.</p>;
  return (
    <div style={{display:'grid', gap:8}}>
      <h3>Manual Assign</h3>
      <input placeholder="Ride ID" value={rideId} onChange={e=>setRideId(e.target.value)} />
      <input placeholder="Driver ID" value={driverId} onChange={e=>setDriverId(e.target.value)} />
  <button disabled={!rideId||!driverId} onClick={async ()=>{ try { const r = await api.manualAssign(token, rideId, driverId); setResult({ ok:true, ...r }); } catch(e:any){ setResult({ ok:false, error: e?.friendlyMessage || e?.error || 'assign_failed', code: e?.code }); } }}>Assign</button>
  <pre style={{background:'#111', color:'#0f0', padding:6, fontSize:11, maxHeight:160, overflow:'auto'}}>{result? JSON.stringify(result,null,2): ''}</pre>
    </div>
  );
};
