import React from 'react';
import { cn } from '../../lib/utils.js';

export const Button = React.forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-gradient-to-r from-[#9200cc] to-[#34075a] text-white shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25',
    outline: 'border border-purple-100 bg-white text-slate-900 shadow-sm hover:bg-purple-50 hover:text-purple-800',
    ghost: 'text-slate-700 hover:bg-purple-50 hover:text-purple-800',
    destructive: 'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600',
    secondary: 'bg-purple-50 text-purple-800 hover:bg-purple-100',
  };

  const sizes = {
    default: 'h-11 px-5 py-2.5',
    sm: 'h-9 px-3.5',
    lg: 'h-12 px-8',
    icon: 'h-11 w-11',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-black ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
Button.displayName = 'Button';
