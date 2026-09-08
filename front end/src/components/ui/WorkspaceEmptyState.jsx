import React from 'react';
import { ArrowRight, Boxes, PlugZap } from 'lucide-react';

export default function WorkspaceEmptyState({ title, description, primaryLabel, onPrimary, secondaryLabel, onSecondary }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-700"><Boxes size={25} strokeWidth={1.8} /></div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onPrimary && primaryLabel ? <button type="button" onClick={onPrimary} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"><ArrowRight size={15} />{primaryLabel}</button> : null}
        {onSecondary && secondaryLabel ? <button type="button" onClick={onSecondary} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"><PlugZap size={15} />{secondaryLabel}</button> : null}
      </div>
    </div>
  );
}
