import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

export const PaymentsPanel: React.FC = () => {
  const { token } = useAuth();
  const [rideId, setRideId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [log, setLog] = useState<any[]>([]);
  function push(entry:any){ setLog(l => [entry, ...l].slice(0,50)); }
  if (!token) return <p>Auth required</p>;
  return (
    <div style={{display:'grid', gap:12}}>
      <h2>Payments</h2>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <input placeholder="Ride ID" value={rideId} onChange={e=>setRideId(e.target.value)} />
  <button disabled={!rideId} onClick={async ()=>{ try { const key = 'init-'+crypto.randomUUID(); const p = await api.paymentInitiate(token, { rideId, method:'card' }, key); setPaymentId(p.paymentId||p._id); push({ action:'init', p, key }); } catch(e:any){ push({ action:'err', e:e?.friendlyMessage||e?.error||'init_failed' }); } }}>Initiate</button>
        <input placeholder="Payment ID" value={paymentId} onChange={e=>setPaymentId(e.target.value)} />
        <input placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} style={{width:90}} />
        <button disabled={!paymentId} onClick={async ()=>{ try { const r = await api.paymentGet(token, paymentId); push({ action:'get', r }); } catch(e:any){ push({ action:'err', e }); } }}>Get</button>
  <button disabled={!paymentId} onClick={async ()=>{ try { const a = amount? parseFloat(amount): undefined; const key='cap-'+crypto.randomUUID(); const r = await api.paymentCapture(token, paymentId, a, key); push({ action:'capture', r, key }); } catch(e:any){ const code = e?.code||e?.error; if(code==='concurrent_update'){ push({ action:'err', e:'concurrent_update_retry'});} else { push({ action:'err', e:e?.friendlyMessage||code||'capture_failed' }); } } }}>Capture</button>
  <button disabled={!paymentId} onClick={async ()=>{ try { const a = amount? parseFloat(amount): undefined; const key='ref-'+crypto.randomUUID(); const r = await api.paymentRefund(token, paymentId, a, key); push({ action:'refund', r, key }); } catch(e:any){ const code = e?.code||e?.error; if(code==='concurrent_update'){ push({ action:'err', e:'concurrent_update_retry'});} else { push({ action:'err', e:e?.friendlyMessage||code||'refund_failed' }); } } }}>Refund</button>
      </div>
      <pre style={{maxHeight:240, overflow:'auto', background:'#111', color:'#0f0', padding:8, fontSize:11}}>{log.map((l,i)=>`#${i} ${JSON.stringify(l)}\n`).join('')}</pre>
    </div>
  );
};
