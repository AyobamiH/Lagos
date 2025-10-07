import React from 'react';

export const Card: React.FC<{ title?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, actions, className='', children }) => {
  return (
    <div className={`card relative overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
          {title && <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200 uppercase">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="text-sm text-slate-700 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
};
