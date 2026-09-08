import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Power, Trash2, X } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

let openConfirmDialog = null;

export function confirmAction(options = {}) {
  if (!openConfirmDialog) {
    return Promise.resolve(window.confirm(options.message || options.title || 'Are you sure?'));
  }

  return new Promise((resolve) => {
    openConfirmDialog({ ...options, resolve });
  });
}

export function ConfirmActionHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    openConfirmDialog = (next) => setState(next);
    return () => {
      openConfirmDialog = null;
    };
  }, []);

  const close = (answer) => {
    const resolver = state?.resolve;
    setState(null);
    resolver?.(answer);
  };

  const tone = state?.tone || 'warning';
  const isDanger = tone === 'danger';
  const isToggle = tone === 'toggle';
  const Icon = isDanger ? Trash2 : isToggle ? Power : AlertTriangle;

  return (
    <Modal
      isOpen={Boolean(state)}
      onClose={() => close(false)}
      title={state?.title || 'Please confirm'}
      className="max-w-md"
      zIndex="z-[100000]"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${
            isDanger ? 'bg-red-50 text-red-600' : isToggle ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-600'
          }`}>
            <Icon size={24} />
          </div>
          <div>
            <p className="text-sm leading-6 text-slate-600">
              {state?.message || 'This action needs your confirmation before continuing.'}
            </p>
            {state?.hint && (
              <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                {state.hint}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => close(false)}
            className="rounded-2xl border-slate-200 bg-white px-5"
          >
            <X size={15} className="mr-2" />
            {state?.cancelLabel || 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={() => close(true)}
            className={`rounded-2xl px-5 text-white ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-purple-700 to-fuchsia-600 shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700'
            }`}
          >
            {isDanger ? <Trash2 size={15} className="mr-2" /> : <CheckCircle2 size={15} className="mr-2" />}
            {state?.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
