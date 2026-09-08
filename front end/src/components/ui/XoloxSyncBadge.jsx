import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { getGenericIntegrationSettings } from '../../services/api/legacy.js';

export default function XoloxSyncBadge() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'synced' | 'local'

  useEffect(() => {
    let cancelled = false;
    getGenericIntegrationSettings()
      .then((res) => {
        if (cancelled) return;
        const entry = (res?.integrations || []).find((i) => i.provider_id === 'xolox-crm');
        const synced = Boolean(entry && entry.is_active !== false && entry.secret_configured?.api_key);
        setStatus(synced ? 'synced' : 'local');
      })
      .catch(() => { if (!cancelled) setStatus('local'); });
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') return null;

  if (status === 'synced') {
    return (
      <span
        title="Live-synced with XOLOX CRM"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700"
      >
        <Cloud className="h-3.5 w-3.5" /> Synced with XOLOX CRM
      </span>
    );
  }

  return (
    <span
      title="Connect XOLOX CRM with an API key (Settings > Integrations) to sync this list live"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600"
    >
      <CloudOff className="h-3.5 w-3.5" /> Local only
    </span>
  );
}
