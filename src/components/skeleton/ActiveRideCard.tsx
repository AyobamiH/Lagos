import React from 'react';
import { Ride } from '../../types/domain';
import { StatusBadge } from '../StatusBadge';

interface Props { ride: Ride | null; onOpen?: () => void; }
export const ActiveRideCard: React.FC<Props> = ({ ride }) => {
  if (!ride) return null;
  const driver: any = (ride as any).driver;
  return (
    <div className="fixed bottom-2 inset-x-2 rounded-2xl shadow bg-white p-4 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Active Ride</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">Status: <StatusBadge status={ride.status} /></p>
          {driver && (
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 truncate">
              {driver.photoUrl && <img src={driver.photoUrl} alt="Driver" className="w-6 h-6 rounded-full object-cover bg-slate-200" onError={(e:any)=>{ e.currentTarget.style.display='none'; }} />}
              <span className="truncate">{driver.name || 'Driver'}</span>
              <span className="opacity-70">•</span>
              <span>Plate: {driver.plate || driver.licensePlate || '—'}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">Fare est: ₦{ride.finalFare ?? ride.fare}</p>
        </div>
      </div>
    </div>
  );
};
