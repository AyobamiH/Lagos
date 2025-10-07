import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

const variantClasses: Record<string,string> = {
  primary: 'bg-brand hover:bg-brand-dark text-white shadow focus:ring-brand',
  secondary: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 focus:ring-slate-400',
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-slate-400',
  danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
};

export const Button: React.FC<ButtonProps> = ({ variant='primary', loading, className='', disabled, children, ...rest }) => {
  return (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (<span className="inline-block w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />)}
      <span>{children}</span>
    </button>
  );
};
