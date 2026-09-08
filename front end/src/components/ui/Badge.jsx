import React from 'react';
import { cn } from '../../lib/utils.js';

export const Badge = ({ className, variant = 'default', ...props }) => {
  const variants = {
    default: 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100/80',
    secondary: 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100/80',
    destructive: 'border-transparent bg-red-100 text-red-700 hover:bg-red-100/80',
    outline: 'border-purple-100 bg-white text-slate-700',
  };

  return (
    <div className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-black transition-colors focus:outline-none focus:ring-4 focus:ring-purple-100', variants[variant], className)} {...props} />
  );
};
