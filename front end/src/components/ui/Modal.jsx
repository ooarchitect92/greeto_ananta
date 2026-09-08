import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Button } from './Button.jsx';

export function Modal({ isOpen, onClose, title, children, className, zIndex = 'z-50' }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center overflow-y-auto bg-slate-950/55 p-2 backdrop-blur-md animate-in fade-in duration-200 sm:p-4`}>
      <div
        className={cn(
          "relative my-auto flex w-full max-w-lg max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-purple-950/20 animate-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]",
          className
        )}
        style={{ color: '#111827' }}
      >
        <div className="relative flex shrink-0 items-center justify-between border-b border-purple-100 bg-gradient-to-r from-white to-purple-50 px-5 py-4 sm:px-7 sm:py-5">
          <div className="absolute right-14 top-2 h-14 w-14 rounded-full bg-purple-200/40 blur-2xl" />
          <h3 className="relative text-lg font-black text-slate-950">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="relative h-9 w-9 rounded-2xl">
            <X size={18} className="text-slate-500" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
