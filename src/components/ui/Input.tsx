import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  label?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({ error, label, hint, className='', id, ...rest }) => {
  const inputId = id || React.useId();
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>}
      <input
        id={inputId}
        className={`rounded-md border text-sm px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50 ${error? 'border-red-500 focus:ring-red-500 focus:border-red-500':''} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
