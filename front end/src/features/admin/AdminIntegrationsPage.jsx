import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plug, RefreshCw, Search } from 'lucide-react';
import { getAdminIntegrationMonitor } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminIntegrationsPage() {
  const [accounts, setAccounts] = useState([]);
  const [failedActions, setFailedActions] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [retryJobs, setRetryJobs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false });
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getAdminIntegrationMonitor({ page, limit: 20, search, provider })
        .then((body) => {
          if (cancelled) return;
          setAccounts(body?.accounts || []);
          setFailedActions(body?.failedActions || []);
          setWebhookEvents(body?.webhookEvents || []);
          setRetryJobs(body?.retryJobs || []);
          setMeta(body?.meta || { page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false });
        })
        .catch((requestError) => {
          if (!cancelled) setError(requestError?.message || 'Unable to load integration monitor');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, search ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [page, search, provider, refreshKey]);

  const issueSections = [
    { title: 'Failed provider actions', rows: failedActions },
    { title: 'Webhook failures', rows: webhookEvents },
    { title: 'Retry jobs', rows: retryJobs },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Integration Monitoring</h1>
          <p className="mt-1 text-sm text-gray-500">Track workspace provider accounts, webhook failures, retry jobs, and failed actions.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Connected accounts</p><p className="mt-2 text-3xl font-black text-gray-900">{meta.total}</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Webhook failures</p><p className="mt-2 text-3xl font-black text-red-600">{webhookEvents.length}</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Retry queue</p><p className="mt-2 text-3xl font-black text-amber-600">{retryJobs.length}</p></div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search provider, customer, category..." className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-purple-200" />
          </div>
          <select value={provider} onChange={(event) => { setProvider(event.target.value); setPage(1); }} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none">
            <option value="all">All providers</option><option value="whatsapp">WhatsApp</option><option value="openai">OpenAI</option><option value="zoom">Zoom</option><option value="razorpay">Razorpay</option><option value="stripe">Stripe</option><option value="cashfree">Cashfree</option><option value="xolox-crm">XOLOX CRM</option>
          </select>
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">Provider accounts</h2></div>
        <div className="divide-y divide-gray-100">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700"><Plug size={18} /></span><div><p className="text-sm font-bold text-gray-900">{account.provider?.name || account.category}</p><p className="text-xs text-gray-400">{account.customer?.email || 'Unknown customer'} · {account.provider?.key || account.category}</p></div></div>
              <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${account.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}><CheckCircle2 size={13} /> {account.isActive ? 'Active' : 'Inactive'}</span>{account.isDefault && <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">Default</span>}<span className="text-xs text-gray-400">Updated {formatTime(account.updatedAt)}</span></div>
            </div>
          ))}
          {!loading && accounts.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-500">No connected provider accounts found.</div>}
          {loading && <div className="px-5 py-8"><GreetoLoader label="Loading integration monitor..." sublabel="Checking connected provider accounts" /></div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {issueSections.map((section) => <div key={section.title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="font-bold text-gray-900">{section.title}</h2><div className="mt-4 space-y-3">{section.rows.length === 0 ? <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">No issues found.</p> : section.rows.map((row) => <div key={row.id} className="rounded-xl bg-red-50/60 p-3"><p className="flex items-center gap-1 text-xs font-bold text-red-700"><AlertTriangle size={13} />{row.providerKey || row.action || row.eventType || 'Provider event'}</p><p className="mt-1 text-xs text-red-500">{row.errorMessage || row.status}</p></div>)}</div></div>)}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-500">{meta.total} total accounts · Page {meta.page} of {meta.totalPages}</p><div className="flex gap-2"><button disabled={!meta.hasPrevPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"><ChevronLeft size={15} /></button><button disabled={!meta.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"><ChevronRight size={15} /></button></div></div>
    </div>
  );
}
