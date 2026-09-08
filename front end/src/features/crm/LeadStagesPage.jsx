import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Pencil, Trash2, CheckCircle2, Circle, GitBranch, Palette } from 'lucide-react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import XoloxSyncBadge from '../../components/ui/XoloxSyncBadge.jsx';
import LeadTaxonomyPage, { TAXONOMY_COLORS, getTaxonomyAuthHeaders } from '../../components/ui/LeadTaxonomyPage.jsx';

async function apiGetStages() {
  const res = await fetch('/api/settings/lead-stages', { headers: getTaxonomyAuthHeaders() });
  return res.json();
}
async function apiCreateStage(body) {
  const res = await fetch('/api/settings/lead-stages', { method: 'POST', headers: getTaxonomyAuthHeaders(), body: JSON.stringify(body) });
  return res.json();
}
async function apiUpdateStage(id, body) {
  const res = await fetch(`/api/settings/lead-stages/${id}`, { method: 'PUT', headers: getTaxonomyAuthHeaders(), body: JSON.stringify(body) });
  return res.json();
}
async function apiDeleteStage(id) {
  const res = await fetch(`/api/settings/lead-stages/${id}`, { method: 'DELETE', headers: getTaxonomyAuthHeaders() });
  return res.json();
}

function StageFormModal({ isOpen, onClose, stage, onSaved }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color || '#3b82f6');
      setIsClosed(stage.is_closed);
    } else {
      setName('');
      setColor('#3b82f6');
      setIsClosed(false);
    }
    setError('');
  }, [stage, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await (stage
        ? apiUpdateStage(stage.id, { name, color, is_closed: isClosed })
        : apiCreateStage({ name, color, is_closed: isClosed }));
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
    <Modal isOpen={isOpen} onClose={onClose} title={stage ? 'Edit Pipeline Stage' : 'Create Pipeline Stage'} className="max-w-4xl">
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-bold text-slate-800">Stage Name <span className="text-red-500">*</span></label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Qualified, Interested..."
              className="mt-2 h-12 rounded-2xl border-slate-200 bg-slate-50/70 focus-visible:ring-purple-500"
            />
          </div>

          <div className="rounded-3xl border border-purple-100 bg-purple-50/40 p-4">
            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Palette className="h-4 w-4 text-purple-600" />
              Pipeline lane color
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
                    borderRadius: 12,
                    flexShrink: 0,
                    border: color === c ? '3px solid #fff' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 0 3px ${c}` : '0 8px 18px rgba(15,23,42,0.12)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="shadow-sm ring-2 ring-white" style={{ background: color, width: 18, height: 18, borderRadius: 8 }} />
              <span className="text-xs font-mono text-slate-500">{color}</span>
            </div>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-purple-200 hover:bg-purple-50/30">
            <input type="checkbox" checked={isClosed} onChange={e => setIsClosed(e.target.checked)} className="h-4 w-4 accent-purple-600" />
            <div>
              <p className="text-sm font-bold text-slate-800">Closed stage</p>
              <p className="text-xs text-slate-500">Mark this lane as Won/Lost or end-of-funnel.</p>
            </div>
          </label>

          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="rounded-[28px] border border-purple-100 bg-gradient-to-br from-slate-950 to-purple-950 p-5 text-white shadow-xl shadow-purple-200">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-purple-200">Pipeline Preview</p>
          <div className="mt-6 rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-10 w-2 rounded-full" style={{ background: color }} />
                <div>
                  <p className="text-lg font-black">{name || 'Pipeline stage'}</p>
                  <p className="text-xs font-semibold text-white/60">{isClosed ? 'Closed lane' : 'Active lane'}</p>
                </div>
              </div>
              {isClosed ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <GitBranch className="h-5 w-5 text-purple-200" />}
            </div>
            <div className="space-y-2">
              <div className="rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
                <p className="text-xs font-black text-slate-500">Lead card preview</p>
                <p className="mt-1 text-sm font-bold">Customer moves into this stage</p>
              </div>
              <div className="rounded-2xl border border-dashed border-white/20 p-3 text-xs font-semibold text-white/60">
                Automations can trigger from this lane.
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-2xl px-5 text-white hover:bg-white/10">Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-white px-5 text-purple-800 shadow-lg hover:bg-purple-50"
            >
              {loading ? 'Saving...' : stage ? 'Save Changes' : 'Create Stage'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function LeadStagesPage() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editStage, setEditStage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetStages();
      setStages(res.stages || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!(await confirmAction({
      title: 'Delete lead stage?',
      message: 'Delete this stage? This cannot be undone.',
      confirmLabel: 'Delete stage',
      tone: 'danger',
    }))) return;
    await apiDeleteStage(id);
    load();
  }

  const activeCount = stages.filter(s => !s.is_closed).length;
  const closedCount = stages.filter(s => s.is_closed).length;

  return (
    <>
      <LeadTaxonomyPage
        eyebrow="CRM Pipeline"
        title="Lead Stages"
        description="Define the stages used by sales pipeline, conversations, and automations."
        headerIcon={Layers}
        extraHeaderBadge={<XoloxSyncBadge />}
        onCreate={() => { setEditStage(null); setModalOpen(true); }}
        createLabel="New Stage"
        statCards={[
          { label: 'Total Stages', icon: GitBranch, iconBg: 'bg-purple-50', iconColor: 'text-purple-700', value: stages.length },
          { label: 'Active Stages', icon: Circle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', value: activeCount },
          { label: 'Closed Stages', icon: CheckCircle2, iconBg: 'bg-slate-100', iconColor: 'text-slate-700', value: closedCount },
        ]}
        listIcon={Layers}
        listTitle="Pipeline Journey"
        loading={loading}
        loadingLabel="Loading lead stages..."
        loadingSublabel="Fetching workflow pipeline stages"
        items={stages}
        emptyIcon={Layers}
        emptyMessage="No stages yet."
        emptyCreateLabel="Create your first stage"
        gridClassName="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
        renderCard={(s, index) => (
          <div key={s.id} className="relative overflow-hidden rounded-[28px] border border-purple-100 bg-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-100">
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: s.color || '#64748b' }} />
            <div className="rounded-[24px] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: s.color || '#64748b' }}>
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-950">{s.name}</p>
                    <p className="text-xs font-medium text-slate-400">Step {index + 1} · Position #{s.position}</p>
                  </div>
                </div>
                {s.is_closed
                  ? <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-100 text-slate-700"><CheckCircle2 className="h-3 w-3" /> Closed</Badge>
                  : <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"><Circle className="h-3 w-3" /> Active</Badge>}
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Lane behavior</p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {s.is_closed ? 'End-of-funnel stage for resolved outcomes.' : 'Active stage for ongoing lead movement.'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-lg shadow-sm ring-2 ring-white" style={{ background: s.color || '#64748b' }} />
                  <span className="text-xs font-mono text-slate-500">{s.color || '#64748b'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="rounded-xl text-slate-600 hover:bg-purple-50 hover:text-purple-700" onClick={() => { setEditStage(s); setModalOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      />
      <StageFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} stage={editStage} onSaved={load} />
    </>
  );
}
