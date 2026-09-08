import React from 'react';
import { cn } from '../../lib/utils.js';

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-purple-100 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-bold placeholder:text-slate-400 focus-visible:border-purple-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-70',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[96px] w-full rounded-3xl border border-purple-100 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 shadow-sm ring-offset-white placeholder:text-slate-400 focus-visible:border-purple-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-70',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';
