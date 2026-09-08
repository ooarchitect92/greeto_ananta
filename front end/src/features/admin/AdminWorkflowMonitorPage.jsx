import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, GitBranch, Loader2, Pause, Play, RotateCcw, Search } from 'lucide-react';
import { getAdminWorkflowMonitor, retryAdminWorkflowRun, setAdminWorkflowStatus } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN');
}

export default function AdminWorkflowMonitorPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false });
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async (cancelled = () => false) => {
    setLoading(true);
    try {
      const body = await getAdminWorkflowMonitor({ page, limit: 20, status, search: search.trim() });
      if (cancelled()) return;
      setItems(body.items || []);
      setMeta(body.meta || meta);
      setError('');
    } catch (err) {
      if (!cancelled()) { setItems([]); setError(err.message || 'Unable to load workflows'); }
    } finally {
      if (!cancelled()) setLoading(false);
    }
  };

  useEffect(() => {
    let stopped = false;
    const timer = window.setTimeout(() => load(() => stopped), search ? 250 : 0);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [page, search, status]);

  const changeStatus = async (item) => {
    setBusyId(item.id); setError('');
    try {
      await setAdminWorkflowStatus(item.id, item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      await load();
    } catch (err) { setError(err.message || 'Unable to update workflow status'); }
    finally { setBusyId(null); }
  };

  const retryRun = async (runId) => {
    setBusyId(runId); setError('');
    try { await retryAdminWorkflowRun(runId); await load(); }
    catch (err) { setError(err.message || 'Unable to retry workflow run'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="min-h-full bg-[#f4f1fb] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-500">Operations</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Workflow Monitoring</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Review active automations, trigger setup, recent runs, failed runs, and webhook activity.</p>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search workflows, workspaces, or owners..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" /></div>
            {['all', 'ACTIVE', 'INACTIVE'].map((value) => <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }} className={`rounded-xl border px-4 py-2 text-xs font-black capitalize transition ${status === value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{value.toLowerCase()}</button>)}
          </div>
          {error && <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const failed = item.runs?.some((run) => run.status === 'FAILED');
            return <article key={item.id} className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><div className="flex items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><GitBranch size={17} /></span><h2 className="truncate text-base font-black text-slate-950">{item.name}</h2></div><p className="mt-2 truncate text-xs font-semibold text-slate-500">{item.customer?.name || item.customer?.email || 'Unknown workspace'} · Trigger: {item.trigger}</p>{item.description && <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-500">{item.description}</p>}</div>
                <div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span><button type="button" disabled={busyId === item.id} onClick={() => changeStatus(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">{busyId === item.id ? <Loader2 size={12} className="animate-spin" /> : item.status === 'ACTIVE' ? <Pause size={12} /> : <Play size={12} />}{item.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button></div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">{[['Runs', item._count?.runs], ['Queue', item._count?.scheduledTasks], ['Webhooks', item._count?.webhookEvents]].map(([label, count]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{Number(count || 0).toLocaleString('en-IN')}</p></div>)}</div>
              <div className="mt-4 space-y-2">{!item.runs?.length ? <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs font-semibold text-slate-400">No recent runs.</p> : item.runs.map((run) => <div key={run.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700">{run.recipient || 'Unknown recipient'}</p><p className="text-[11px] font-medium text-slate-400">{formatTime(run.startedAt)}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${run.status === 'FAILED' ? 'bg-red-50 text-red-600' : run.status === 'RUNNING' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{run.status === 'FAILED' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{run.status}</span>{run.status === 'FAILED' && <button type="button" disabled={busyId === run.id} onClick={() => retryRun(run.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2 py-1 text-[10px] font-black text-red-600 hover:bg-red-50 disabled:opacity-50"><RotateCcw size={11} /> Retry</button>}</div>)}</div>
              {failed && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">One or more recent runs failed. Review the workflow before enabling similar automations.</p>}
              <p className="mt-3 text-right text-[11px] font-semibold text-slate-400">Updated {formatTime(item.updatedAt)}</p>
            </article>;
          })}
        </div>
        {!loading && !items.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">No workflows found.</div>}
        {loading && <div className="rounded-2xl bg-white p-8"><GreetoLoader label="Loading workflows..." sublabel="Checking workflow runs and health" /></div>}
        <div className="flex items-center justify-between rounded-2xl border border-purple-100 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{meta.total} total workflows · Page {meta.page} of {meta.totalPages}</p><div className="flex gap-2"><button type="button" disabled={!meta.hasPrevPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-slate-200 p-2.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button><button type="button" disabled={!meta.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-slate-200 p-2.5 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
      </div>
    </div>
  );
}
