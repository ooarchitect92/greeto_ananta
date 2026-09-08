import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Plus, Pencil, Trash2, Search, Filter, X, AlertTriangle, BookOpen, CircleDollarSign, Target, UsersRound, CalendarDays, ArrowUpRight, BriefcaseBusiness } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';

const OPPORTUNITY_TYPES = ['CPA', 'CMA US', 'CFA', 'ACCA', 'EA'];

const TYPE_COLORS = {
  'CPA':    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  'CMA US': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'CFA':    { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  'ACCA':   { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  'EA':     { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
};

const STATUS_BADGE = {
  open: { label: 'Open', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  won:  { label: 'Won',  className: 'bg-green-50 text-green-700 border-green-200' },
  lost: { label: 'Lost', className: 'bg-red-50 text-red-700 border-red-200' },
};

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : undefined };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, { headers: getAuthHeaders(), ...opts });
  return res.json();
}

function fmt(val) {
  if (!val && val !== 0) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

// ─── Duplicate Warning Modal ────────────────────────────────────────────────
function DuplicateWarningModal({ isOpen, onClose, duplicate, onForceCreate }) {
  if (!isOpen || !duplicate) return null;
  const ex = duplicate.existing;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duplicate Opportunity Detected">
      <div className="space-y-4">
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{duplicate.message}</p>
            <p className="text-xs text-amber-600 mt-0.5">This lead is already being tracked for this course.</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Existing Opportunity</p>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-slate-500">Course</span>
            <span className="font-medium text-slate-800">{ex.opportunity_type}</span>
            <span className="text-slate-500">Status</span>
            <span className="font-medium text-slate-800 capitalize">{ex.status}</span>
            {ex.lead_stage_name && <>
              <span className="text-slate-500">Stage</span>
              <div className="flex items-center gap-1.5">
                <div style={{ background: ex.lead_stage_color || '#64748b', width: 8, height: 8, borderRadius: '50%' }} />
                <span className="font-medium text-slate-800">{ex.lead_stage_name}</span>
              </div>
            </>}
            {ex.lead_status_name && <>
              <span className="text-slate-500">Lead Status</span>
              <div className="flex items-center gap-1.5">
                <div style={{ background: ex.lead_status_color || '#64748b', width: 8, height: 8, borderRadius: '50%' }} />
                <span className="font-medium text-slate-800">{ex.lead_status_name}</span>
              </div>
            </>}
            {ex.assigned_user_name && <>
              <span className="text-slate-500">Assigned To</span>
              <span className="font-medium text-slate-800">{ex.assigned_user_name}</span>
            </>}
            <span className="text-slate-500">Created</span>
            <span className="font-medium text-slate-800">{new Date(ex.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        <p className="text-sm text-slate-600">Do you want to create a second opportunity anyway?</p>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={onForceCreate}>
            Create Anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create / Edit Modal ────────────────────────────────────────────────────
function OppModal({ isOpen, onClose, opp, stages, statuses, onSaved, onDuplicate }) {
  const empty = { opportunity_type: 'CPA', value: '', currency: 'INR', status: 'open', lead_stage_id: '', lead_status_id: '', notes: '', expected_close_date: '' };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(opp ? {
      opportunity_type:    opp.opportunity_type || 'CPA',
      value:               opp.value ?? '',
      currency:            opp.currency || 'INR',
      status:              opp.status || 'open',
      lead_stage_id:       opp.lead_stage_id || '',
      lead_status_id:      opp.lead_status_id || '',
      notes:               opp.notes || '',
      expected_close_date: opp.expected_close_date ? opp.expected_close_date.split('T')[0] : '',
    } : empty);
    setError('');
  }, [opp, isOpen]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(force = false) {
    setLoading(true); setError('');
    try {
      const body = {
        ...form,
        value:               Number(form.value) || 0,
        lead_stage_id:       form.lead_stage_id || null,
        lead_status_id:      form.lead_status_id || null,
        expected_close_date: form.expected_close_date || null,
        ...(force ? { force: true } : {}),
      };
      const res = opp
        ? await apiFetch(`/api/opportunities/${opp.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await apiFetch('/api/opportunities', { method: 'POST', body: JSON.stringify(body) });

      if (res.error === 'duplicate') {
        onDuplicate(res, () => submit(true));
        return;
      }
      if (res.error) { setError(res.error); return; }
      onSaved();
      onClose();
    } catch { setError('Something went wrong'); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await submit(false);
  }

  const typeStyle = TYPE_COLORS[form.opportunity_type] || {};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={opp ? 'Edit Opportunity' : 'New Opportunity'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Opportunity type selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Course / Opportunity <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {OPPORTUNITY_TYPES.map(t => {
              const s = TYPE_COLORS[t] || {};
              const active = form.opportunity_type === t;
              return (
                <button key={t} type="button" onClick={() => set('opportunity_type', t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${active ? `${s.bg} ${s.text} ${s.border} shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Value (₹)</label>
            <Input type="number" min="0" value={form.value} onChange={e => set('value', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="h-9 w-full px-3 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Lead Stage</label>
            <select value={form.lead_stage_id} onChange={e => set('lead_stage_id', e.target.value)}
              className="h-9 w-full px-3 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— None —</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Lead Status</label>
            <select value={form.lead_status_id} onChange={e => set('lead_status_id', e.target.value)}
              className="h-9 w-full px-3 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— None —</option>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Expected Close Date</label>
          <Input type="date" value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            placeholder="Any notes about this opportunity…"
            className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : opp ? 'Save Changes' : 'Create Opportunity'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const [opps, setOpps] = useState([]);
  const [stages, setStages] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpp, setEditOpp] = useState(null);
  const [dupData, setDupData] = useState(null);
  const [dupForceCallback, setDupForceCallback] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType)   params.set('opportunity_type', filterType);
      if (search)       params.set('search', search);
      const [res, stageRes, statusRes] = await Promise.all([
        apiFetch(`/api/opportunities?${params}`),
        apiFetch('/api/settings/lead-stages'),
        apiFetch('/api/lead-statuses'),
      ]);
      setOpps(res.opportunities || []);
      setStages(stageRes.stages || []);
      setStatuses(statusRes.statuses || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filterStatus, filterType, search]);

  useEffect(() => {
    setCurrentPage(1);
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load]);

  async function handleDelete(id) {
    if (!(await confirmAction({
      title: 'Delete opportunity?',
      message: 'Delete this opportunity?',
      confirmLabel: 'Delete opportunity',
      tone: 'danger',
    }))) return;
    await apiFetch(`/api/opportunities/${id}`, { method: 'DELETE' });
    load();
  }

  function handleDuplicate(data, forceCallback) {
    setDupData(data);
    setDupForceCallback(() => forceCallback);
    setModalOpen(false);
  }

  function handleForceCreate() {
    setDupData(null);
    if (dupForceCallback) dupForceCallback();
  }

  const openPipeline = opps.filter(o => o.status === 'open').reduce((s, o) => s + Number(o.value || 0), 0);
  const wonValue = opps.filter(o => o.status === 'won').reduce((s, o) => s + Number(o.value || 0), 0);

  // Per-type breakdown
  const typeBreakdown = OPPORTUNITY_TYPES.map(t => ({
    type: t,
    count: opps.filter(o => o.opportunity_type === t).length,
    open:  opps.filter(o => o.opportunity_type === t && o.status === 'open').length,
  }));

  const totalPages = Math.ceil(opps.length / itemsPerPage);
  const paged = opps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const hasFilters = search || filterStatus || filterType;
  const closeRate = opps.length ? Math.round((opps.filter(o => o.status === 'won').length / opps.length) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f7fb]">
      <div className="border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
        <div className="mx-auto flex max-w-[1480px] flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">Revenue workspace</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{opps.length} tracked</span>
              </div>
              <h1 className="text-2xl font-semibold text-slate-950">Opportunities</h1>
              <p className="mt-1 text-sm text-slate-500">A focused view of active course interest, deal value, and conversion progress.</p>
            </div>
          </div>
          <Button className="h-10 rounded-lg bg-slate-950 px-4 text-sm shadow-sm hover:bg-slate-800" onClick={() => { setEditOpp(null); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Opportunity
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] space-y-5 p-5 lg:p-8">

        {/* Summary cards — top row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active pipeline', value: fmt(openPipeline), detail: `${opps.filter(o => o.status === 'open').length} deals need attention`, icon: CircleDollarSign, tone: 'bg-violet-50 text-violet-700', accent: 'bg-violet-600' },
            { label: 'Converted value', value: fmt(wonValue), detail: `${opps.filter(o => o.status === 'won').length} opportunities won`, icon: Target, tone: 'bg-emerald-50 text-emerald-700', accent: 'bg-emerald-500' },
            { label: 'Win rate', value: `${closeRate}%`, detail: 'Across all visible opportunities', icon: ArrowUpRight, tone: 'bg-sky-50 text-sky-700', accent: 'bg-sky-500' },
            { label: 'Closed lost', value: opps.filter(o => o.status === 'lost').length, detail: 'Review for follow-up opportunities', icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700', accent: 'bg-rose-500' },
          ].map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <div key={metric.label} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
                <div className={`absolute inset-x-0 top-0 h-1 ${metric.accent}`} />
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p></div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}><MetricIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-3 text-xs text-slate-400">{metric.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Per-course breakdown */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-slate-900">Course lanes</h2><p className="mt-0.5 text-xs text-slate-400">Select a course to focus the deal register.</p></div>
            {filterType && <button type="button" onClick={() => setFilterType('')} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Clear selection</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {typeBreakdown.map(({ type, count, open }) => {
            const s = TYPE_COLORS[type] || {};
            const active = filterType === type;
            return (
              <button key={type} onClick={() => setFilterType(active ? '' : type)}
                className={`rounded-lg border p-3.5 text-left transition-all ${active ? `${s.bg} ${s.border} shadow-sm` : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className={`h-4 w-4 ${active ? s.text : 'text-slate-400'}`} />
                  <span className={`text-sm font-bold ${active ? s.text : 'text-slate-700'}`}>{type}</span>
                </div>
                <p className="text-xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-400">{open} open</p>
              </button>
            );
          })}
          </div>
        </section>

        {/* Search + filters */}
        <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by course or contact…" className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-200">
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={() => { setSearch(''); setFilterStatus(''); setFilterType(''); }} title="Clear filters">
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-200 px-5 py-4">
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-violet-600" />
                <span className="text-base">Deal register</span>
              </div>
              {totalPages > 1 && (
                <span className="text-sm font-normal text-slate-500">Page {currentPage} of {totalPages}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="py-3 px-4 font-medium">Course</th>
                    <th className="py-3 px-4 font-medium">Contact</th>
                    <th className="py-3 px-4 font-medium">Value</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Stage</th>
                    <th className="py-3 px-4 font-medium">Lead Status</th>
                    <th className="py-3 px-4 font-medium">Close Date</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <GreetoLoader label="Loading opportunities..." sublabel="Fetching lead opportunity pipeline" />
                      </td>
                    </tr>
                  ) : paged.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="h-8 w-8 text-slate-300" />
                          <p className="text-slate-500">{hasFilters ? 'No results match your filters.' : 'No opportunities yet.'}</p>
                          {hasFilters
                            ? <Button variant="link" onClick={() => { setSearch(''); setFilterStatus(''); setFilterType(''); }}>Clear filters</Button>
                            : <Button variant="link" onClick={() => { setEditOpp(null); setModalOpen(true); }}>Create your first opportunity</Button>}
                        </div>
                      </td>
                    </tr>
                  ) : paged.map(o => {
                    const typeStyle = TYPE_COLORS[o.opportunity_type] || {};
                    const badge = STATUS_BADGE[o.status] || STATUS_BADGE.open;
                    return (
                      <tr key={o.id} className="transition-colors hover:bg-violet-50/40">
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`${typeStyle.bg} ${typeStyle.text} ${typeStyle.border} font-semibold`}>
                            {o.opportunity_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {o.contact_name
                            ? <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{o.contact_name.slice(0, 1).toUpperCase()}</span>
                                <div><p className="font-medium text-slate-900">{o.contact_name}</p><p className="text-xs text-slate-400">{o.contact_phone}</p></div>
                              </div>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{fmt(o.value)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          {o.lead_stage_name
                            ? <div className="flex items-center gap-1.5">
                                <div style={{ background: o.lead_stage_color || '#64748b', width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                                <span className="text-slate-700">{o.lead_stage_name}</span>
                              </div>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          {o.lead_status_name
                            ? <div className="flex items-center gap-1.5">
                                <div style={{ background: o.lead_status_color || '#64748b', width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                                <span className="text-slate-700">{o.lead_status_name}</span>
                              </div>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {o.expected_close_date
                            ? new Date(o.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setEditOpp(o); setModalOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(o.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  ← Previous
                </Button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = i + 1;
                    if (totalPages > 5 && currentPage > 3) { p = currentPage - 2 + i; if (p > totalPages) p = i + (totalPages - 4); }
                    return (
                      <Button key={p} variant={currentPage === p ? 'default' : 'ghost'} size="sm" onClick={() => setCurrentPage(p)} className="w-8 h-8 p-0">{p}</Button>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OppModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        opp={editOpp}
        stages={stages}
        statuses={statuses}
        onSaved={load}
        onDuplicate={handleDuplicate}
      />

      <DuplicateWarningModal
        isOpen={!!dupData}
        onClose={() => setDupData(null)}
        duplicate={dupData}
        onForceCreate={handleForceCreate}
      />
    </div>
  );
}
