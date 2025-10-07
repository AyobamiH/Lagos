import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

export const KycPanel: React.FC = () => {
  const { token } = useAuth();
  const [docs, setDocs] = useState('[{"type":"license","id":"ABC123"}]');
  const [result, setResult] = useState<any>(null);
  if (!token) return <p>Auth required</p>;
  return (
    <div style={{display:'grid', gap:8}}>
      <h3>Driver KYC</h3>
      <textarea rows={4} value={docs} onChange={e=>setDocs(e.target.value)} />
      <div style={{display:'flex', gap:8}}>
        <button onClick={async ()=>{ try { const parsed = JSON.parse(docs); const r = await api.driverSubmitKyc(token, parsed); setResult(r); } catch(e:any){ setResult(e); } }}>Submit</button>
      </div>
      <pre style={{background:'#111', color:'#0f0', padding:6, fontSize:11, maxHeight:160, overflow:'auto'}}>{JSON.stringify(result,null,2)}</pre>
    </div>
  );
};
