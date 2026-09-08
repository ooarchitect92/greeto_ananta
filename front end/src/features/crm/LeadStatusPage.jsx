import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Pencil, Trash2, Star, Palette, ListChecks } from 'lucide-react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import XoloxSyncBadge from '../../components/ui/XoloxSyncBadge.jsx';
import LeadTaxonomyPage, { TAXONOMY_COLORS, getTaxonomyAuthHeaders } from '../../components/ui/LeadTaxonomyPage.jsx';

async function apiGetStatuses() {
  const res = await fetch('/api/lead-statuses', { headers: getTaxonomyAuthHeaders() });
  return res.json();
}
async function apiCreateStatus(body) {
  const res = await fetch('/api/lead-statuses', { method: 'POST', headers: getTaxonomyAuthHeaders(), body: JSON.stringify(body) });
  return res.json();
}
async function apiUpdateStatus(id, body) {
  const res = await fetch(`/api/lead-statuses/${id}`, { method: 'PUT', headers: getTaxonomyAuthHeaders(), body: JSON.stringify(body) });
  return res.json();
}
async function apiDeleteStatus(id) {
  const res = await fetch(`/api/lead-statuses/${id}`, { method: 'DELETE', headers: getTaxonomyAuthHeaders() });
  return res.json();
}

function StatusFormModal({ isOpen, onClose, status, onSaved }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#64748b');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status) {
      setName(status.name);
      setColor(status.color || '#64748b');
      setIsDefault(status.is_default);
    } else {
      setName('');
      setColor('#64748b');
      setIsDefault(false);
    }
    setError('');
  }, [status, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await (status
        ? apiUpdateStatus(status.id, { name, color, is_default: isDefault })
        : apiCreateStatus({ name, color, is_default: isDefault }));
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={status ? 'Edit Status Label' : 'Create Status Label'} className="max-w-3xl">
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-purple-500">Live Preview</p>
          <div className="mt-8 flex min-h-48 items-center justify-center">
            <div className="rounded-[28px] border border-white bg-white p-5 text-center shadow-xl shadow-purple-100">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-lg"
                style={{ background: color }}
              >
                <Tag className="h-7 w-7" />
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                style={{ background: color }}
              >
                <span className="h-2 w-2 rounded-full bg-white/80" />
                {name || 'Status label'}
              </span>
              <p className="mt-4 text-xs font-semibold text-slate-500">
                Statuses are quick labels for lead quality and follow-up priority.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-bold text-slate-800">Status Name <span className="text-red-500">*</span></label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Hot Lead, Cold, Interested..."
              className="mt-2 h-12 rounded-2xl border-slate-200 bg-slate-50/70 focus-visible:ring-purple-500"
            />
          </div>

          <div className="rounded-3xl border border-purple-100 bg-purple-50/40 p-4">
            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Palette className="h-4 w-4 text-purple-600" />
              Choose label color
            </label>
            <div className="flex flex-wrap gap-3">
              {TAXONOMY_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className="transition-transform hover:scale-110"
                  style={{
                    background: c,
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: color === c ? '3px solid #fff' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 0 3px ${c}` : '0 8px 18px rgba(15,23,42,0.12)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="shadow-sm ring-2 ring-white" style={{ background: color, width: 16, height: 16, borderRadius: '50%' }} />
              <span className="text-xs font-mono text-slate-500">{color}</span>
            </div>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-purple-200 hover:bg-purple-50/30">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 accent-purple-600" />
            <div>
              <p className="text-sm font-bold text-slate-800">Default status</p>
              <p className="text-xs text-slate-500">Automatically assigned to new leads</p>
            </div>
          </label>

          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-2xl px-5">Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700"
            >
              {loading ? 'Saving...' : status ? 'Save Changes' : 'Create Status'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function LeadStatusPage() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetStatuses();
      setStatuses(res.statuses || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!(await confirmAction({
      title: 'Delete lead status?',
      message: 'Delete this status? This cannot be undone.',
      confirmLabel: 'Delete status',
      tone: 'danger',
    }))) return;
    await apiDeleteStatus(id);
    load();
  }

  const defaultStatus = statuses.find(s => s.is_default);

  return (
    <>
      <LeadTaxonomyPage
        eyebrow="CRM Settings"
        title="Lead Status"
        description="Manage qualification labels used by contacts, inbox, and follow-ups."
        headerIcon={Tag}
        extraHeaderBadge={<XoloxSyncBadge />}
        onCreate={() => { setEditStatus(null); setModalOpen(true); }}
        createLabel="New Status"
        statCards={[
          { label: 'Total Statuses', icon: ListChecks, iconBg: 'bg-purple-50', iconColor: 'text-purple-700', value: statuses.length },
          { label: 'Default Status', icon: Star, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', content: <p className="mt-2 truncate text-lg font-bold text-slate-950">{defaultStatus?.name || '-'}</p> },
          {
            label: 'Colors Used', icon: Palette, iconBg: 'bg-fuchsia-50', iconColor: 'text-fuchsia-600',
            content: (
              <div className="mt-3 flex flex-wrap gap-2">
                {statuses.slice(0, 8).map(s => (
                  <div key={s.id} className="ring-2 ring-white shadow-sm" style={{ background: s.color || '#64748b', width: 22, height: 22, borderRadius: '50%' }} title={s.name} />
                ))}
              </div>
            ),
          },
        ]}
        listIcon={Tag}
        listTitle="Status Labels"
        loading={loading}
        loadingLabel="Loading lead statuses..."
        loadingSublabel="Fetching CRM status options"
        items={statuses}
        emptyIcon={Tag}
        emptyMessage="No statuses yet."
        emptyCreateLabel="Create your first status"
        renderCard={(s) => (
          <div key={s.id} className="group rounded-[26px] border border-purple-100 bg-gradient-to-br from-white to-purple-50/40 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: s.color || '#64748b' }}>
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-950">{s.name}</p>
                  <p className="text-xs font-medium text-slate-400">Position #{s.position}</p>
                </div>
              </div>
              {s.is_default && (
                <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
                  <Star className="h-3 w-3" fill="currentColor" /> Default
                </Badge>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full shadow-sm ring-2 ring-white" style={{ background: s.color || '#64748b' }} />
                <span className="text-xs font-mono text-slate-500">{s.color || '#64748b'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="rounded-xl text-slate-600 hover:bg-purple-50 hover:text-purple-700" onClick={() => { setEditStatus(s); setModalOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      />
      <StatusFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} status={editStatus} onSaved={load} />
    </>
  );
}
