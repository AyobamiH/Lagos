import React from 'react';
import { Ride } from '../../types/domain';

const TIMELINE_FIELDS: Array<{ key: keyof Ride; label: string }> = [
  { key: 'createdAt', label: 'Requested' },
  { key: 'matchedAt', label: 'Matched' },
  { key: 'acceptedAt', label: 'Accepted' },
  { key: 'pickupArrivalAt', label: 'Driver Arrived' },
  { key: 'tripStartAt', label: 'Trip Started' },
  { key: 'completedAt', label: 'Completed' },
];

export const RideTimeline: React.FC<{ ride: Ride | null }> = ({ ride }) => {
  if (!ride) return null;
  return (
    <div className="border-l pl-4 space-y-4">
      {TIMELINE_FIELDS.map(f => {
        const value = ride[f.key];
        if (!value) return null;
        const ts = typeof value === 'string' ? value : (typeof value === 'number' ? value : undefined);
        return (
          <div key={f.key} className="relative">
            <span className="absolute -left-2 top-1 w-3 h-3 rounded-full bg-brand"></span>
            <p className="text-sm"><span className="font-medium">{f.label}:</span> {ts ? new Date(ts).toLocaleTimeString() : '—'}</p>
          </div>
        );
      })}
    </div>
  );
};
