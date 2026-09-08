import React from 'react';

export function GreetoLoader({
  label = 'Loading',
  sublabel = 'Preparing your workspace...',
  className = '',
  fullScreen = false,
}) {
  const content = (
    <div className={`relative flex items-center gap-3 rounded-3xl border border-purple-100 bg-white px-5 py-4 shadow-lg shadow-purple-100/70 ${className}`}>
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-purple-500/10 blur-md" />
        <div className="absolute inset-1 rounded-2xl border-2 border-purple-100 border-t-purple-600 animate-spin" />
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#b000ff] via-[#8b00d4] to-[#4b007f] text-2xl font-black text-white shadow-lg shadow-purple-500/25">
          G
        </div>
      </div>
      <div className="min-w-0">
        <p className="bg-gradient-to-r from-[#7300c7] to-[#c05cff] bg-clip-text text-lg font-black tracking-tight text-transparent">
          Greeto
        </p>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        {sublabel ? <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{sublabel}</p> : null}
      </div>
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div className="flex h-full min-h-[320px] flex-1 items-center justify-center bg-[#f7f3fb]">
      {content}
    </div>
  );
}

export default GreetoLoader;
