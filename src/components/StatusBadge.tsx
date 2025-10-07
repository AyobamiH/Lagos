import React from 'react';
import { RideStatus } from '../types/domain';

const MAP: Record<RideStatus, { label: string; cls: string; pulse?: boolean }> = {
  matching: { label: 'Matching', cls: 'bg-amber-100 text-amber-700 border-amber-300', pulse: true },
  matched: { label: 'Matched', cls: 'bg-sky-100 text-sky-700 border-sky-300' },
  assigned: { label: 'Assigned', cls: 'bg-sky-100 text-sky-700 border-sky-300' },
  pickup_arrived: { label: 'Driver Arrived', cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 border-slate-300' }
};

export const StatusBadge: React.FC<{ status: RideStatus | string | undefined; className?: string; minimal?: boolean }> = ({ status, className='', minimal }) => {
  if (!status || !(status in MAP)) return null;
  const meta = MAP[status as RideStatus];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none shadow-sm ${meta.cls} ${meta.pulse ? 'relative status-pulse' : ''} ${className}`}
      aria-label={`Ride status: ${meta.label}`}
      data-status={status}
    >
      {minimal ? meta.label.charAt(0) : meta.label}
    </span>
  );
};
