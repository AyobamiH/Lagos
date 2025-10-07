import React, { useEffect, useState } from 'react';
import { formatCurrencyNGN } from '../../utils/format';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useFeatureFlags } from '../../context/FeatureFlagsContext';
import { useToast } from '../../context/ToastContext';

export default function ReceiptPage() {
  const { rideId } = useParams();
  const { token } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { push } = useToast();
  const [data, setData] = useState<any|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const enabled = isEnabled('receipts_ui');

  async function load() {
    if (!token || !rideId) return;
    setLoading(true); setError(null);
    try {
      const rec = await api.receipt(token, rideId);
      setData(rec);
    } catch(e:any) { setError(e.friendlyMessage || e.error || 'load_failed'); push({ message:e.friendlyMessage || e.error || 'Receipt load failed', type:'error' }); }
    setLoading(false);
  }

  useEffect(()=>{ if (enabled) load(); }, [enabled, token, rideId]);

  if (!enabled) return <p style={{fontSize:12, opacity:0.7}}>Receipt feature not enabled.</p>;
  if (loading) return <p>Loading receipt...</p>;
  if (error) return <p style={{color:'red'}}>{error}</p>;
  if (!data) return <p>No receipt data.</p>;
  return (
    <div style={{display:'grid', gap:8}}>
      <h2>Ride Receipt</h2>
      <div style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <p><strong>Ride:</strong> {data.rideId}</p>
        <p><strong>Status:</strong> {data.status}</p>
  <p><strong>Base Fare:</strong> {formatCurrencyNGN(data.fare)}</p>
  {data.finalFare && <p><strong>Final Fare:</strong> {formatCurrencyNGN(data.finalFare)}</p>}
        {data.surgeMultiplier && <p><strong>Surge Multiplier:</strong> x{data.surgeMultiplier}</p>}
      </div>
    </div>
  );
}