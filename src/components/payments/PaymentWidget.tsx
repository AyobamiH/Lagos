import React, { useState } from 'react';
import { Payment } from '../../types/domain';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../../utils/idempotency';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface Props { rideId: string; initialPayment?: Payment | null; onChange?: (p: Payment)=>void; }
export const PaymentWidget: React.FC<Props> = ({ rideId, initialPayment, onChange }) => {
  const { token } = useAuth();
  const { push } = useToast();
  const [payment, setPayment] = useState<Payment | null>(initialPayment || null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string|null>(null);

  async function initiate() {
    if (!token) return; setLoading(true); setError(null);
    const key = getOrCreateIdempotencyKey(`payments:init:${rideId}`);
    try {
      const p: any = await api.paymentInitiate(token, { rideId, method:'card' }, key);
      setPayment(p); onChange?.(p);
      push({ message:'Payment initiated', type:'info' });
    } catch(e:any) { setError(e.friendlyMessage || e.error || 'init_failed'); }
    setLoading(false);
  }

  async function capture() {
    if (!token || !payment) return; setLoading(true); setError(null);
    const key = getOrCreateIdempotencyKey(`payments:capture:${payment._id}`);
    try {
      const amtNum = amount ? parseInt(amount,10) : undefined;
      const p: any = await api.paymentCapture(token, payment._id, amtNum, key);
      setPayment(p); onChange?.(p);
      // Only clear on a terminal captured state
      if (p.status === 'captured') clearIdempotencyKey(`payments:capture:${payment._id}`);
      push({ message:'Captured', type:'success' });
    } catch(e:any) { setError(e.friendlyMessage || e.error || 'capture_failed'); }
    setLoading(false);
  }

  async function refund() {
    if (!token || !payment) return; setLoading(true); setError(null);
    const key = getOrCreateIdempotencyKey(`payments:refund:${payment._id}`);
    try {
      const amtNum = amount ? parseInt(amount,10) : undefined;
      const p: any = await api.paymentRefund(token, payment._id, amtNum, key);
      setPayment(p); onChange?.(p);
      push({ message:'Refunded', type:'info' });
    } catch(e:any) { setError(e.friendlyMessage || e.error || 'refund_failed'); }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
      <h3 className="font-semibold text-sm">Payment</h3>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {!payment && (
        <button onClick={initiate} disabled={loading} className="px-3 py-2 text-sm rounded-md bg-brand text-white disabled:opacity-50">{loading? 'Starting…':'Initiate Payment'}</button>
      )}
      {payment && (
        <div className="space-y-2 text-xs">
          <p>Status: <span className="font-medium">{payment.status}</span></p>
          <p>Amount: ₦{payment.amount}</p>
          {payment.capturedAmount !== undefined && <p>Captured: ₦{payment.capturedAmount}</p>}
          {payment.refundedAmount !== undefined && <p>Refunded: ₦{payment.refundedAmount}</p>}
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (optional)" className="border rounded px-2 py-1 text-xs w-32 dark:bg-slate-900" />
            <button onClick={capture} disabled={loading || payment.status==='refunded'} className="px-2 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50">Capture</button>
            <button onClick={refund} disabled={loading || payment.status!=='captured'} className="px-2 py-1 rounded bg-yellow-500 text-gray-900 text-xs disabled:opacity-50">Refund</button>
          </div>
        </div>
      )}
    </div>
  );
};
