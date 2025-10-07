import React from 'react';

export const Skeleton: React.FC<{ className?: string; rounded?: string }>= ({ className='', rounded='rounded-md' }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`} aria-hidden="true" />
);

export const RideCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
    <div className="flex justify-between items-center">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-12" />
    </div>
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-3 w-32" />
    <div className="grid grid-cols-3 gap-3 pt-2">
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
    </div>
  </div>
);

export const TimelineSkeleton: React.FC = () => (
  <div className="border-l pl-4 space-y-5">
    {Array.from({ length: 5 }).map((_,i)=>(
      <div key={i} className="relative">
        <span className="absolute -left-2 top-1 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
        <Skeleton className="h-3 w-32" />
      </div>
    ))}
  </div>
);

export const PaymentWidgetSkeleton: React.FC = () => (
  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-8 w-full" />
    <div className="flex gap-2">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-24" />
    </div>
  </div>
);
