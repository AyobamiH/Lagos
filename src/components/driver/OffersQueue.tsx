import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface Offer { rideId:string; fare:number; createdAt:string; status?:string; productType?:string; } // placeholder; would come from realtime

interface Props { offers: Offer[]; onChange?: (next: Offer[]) => void; }
export const OffersQueue: React.FC<Props> = ({ offers, onChange }) => {
  const { token } = useAuth();
  const { push } = useToast();

  async function accept(rideId:string) {
    if (!token) return;
    try { await api.driverAcceptRide(token, rideId); push({ message:`Accepted ride ${rideId}`, type:'success' }); onChange?.(offers.filter(o=>o.rideId!==rideId)); }
    catch(e:any) { if (e?.status===409) { push({ message:'Already assigned. Refreshing offers…', type:'info' }); onChange?.(offers.filter(o=>o.rideId!==rideId)); } else push({ message: e.friendlyMessage||'Accept failed', type:'error' }); }
  }
  async function decline(rideId:string) {
    if (!token) return;
    try { await api.driverDeclineRide(token, rideId); push({ message:`Declined ${rideId}`, type:'info' }); onChange?.(offers.filter(o=>o.rideId!==rideId)); }
    catch(e:any) { push({ message: e.friendlyMessage||'Decline failed', type:'error' }); }
  }

  if (!offers.length) return <p className="text-xs text-gray-500">No offers</p>;
  return (
    <ul className="space-y-2">
      {offers.map(o => (
        <li key={o.rideId} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
          <div>
            <p className="font-medium">Ride {o.rideId}</p>
            <p>Fare est: ₦{o.fare}</p>
            <p className="text-[10px] opacity-70">Age: {Math.round((Date.now()-new Date(o.createdAt).getTime())/1000)}s</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>accept(o.rideId)} className="px-2 py-1 rounded bg-green-600 text-white">Accept</button>
            <button onClick={()=>decline(o.rideId)} className="px-2 py-1 rounded bg-red-500 text-white">Decline</button>
          </div>
        </li>
      ))}
    </ul>
  );
};
