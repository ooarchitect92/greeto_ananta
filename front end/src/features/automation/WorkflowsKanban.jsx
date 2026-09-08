import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import {
  getWorkflow,
  getWorkflowsKanban,
  reorderStageWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  deleteLeadStage,
  createLeadStage,
  getLabels,
  updateWorkflowDelay,
} from './api.js';
import { Plus, X, Check, GripVertical, MoreHorizontal, Search, LayoutGrid, List, Clock, Eye, Pencil, Trash2, Sparkles, Workflow as WorkflowIcon, Zap, RefreshCw, ArrowLeft, ShoppingCart, MessageCircle, UserPlus, Tag, FileText, MousePointerClick, Activity, ShieldCheck, Send, PanelsTopLeft, ListTree } from 'lucide-react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/Table.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import ViewToggle from '../../components/ui/ViewToggle.jsx';
import RunsHistoryPanel from './RunsHistoryPanel.jsx';

const formatDelay = (mins) => {
  if (!mins) return 'Instant';
  const d = Math.floor(mins / (24 * 60));
  const h = Math.floor((mins % (24 * 60)) / 60);
  const m = mins % 60;
  let parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || (d === 0 && h === 0)) parts.push(`${m}m`);
  return parts.join(' ');
};

const triggerTabs = ['All Triggers', 'E-commerce', 'Contacts', 'Custom Events'];
const WORKFLOW_COURSE_OPTIONS = ['CPA', 'CMA USA', 'ACCA', 'CFA', 'CIA', 'EA'];

const workflowTriggerOptions = [
  {
    id: 'cart_abandoned',
    title: 'Cart Abandoned',
    category: 'E-commerce',
    description: 'Triggers when a customer leaves items in their cart without completing checkout.',
    Icon: ShoppingCart,
    tone: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'instagram_auto_dm',
    title: 'Instagram Auto DM',
    category: 'Custom Events',
    description: 'Triggers immediately after a successful purchase or response from Instagram.',
    Icon: MessageCircle,
    tone: 'bg-cyan-50 text-cyan-700',
  },
  {
    id: 'new_contact_created',
    title: 'New Contact Created',
    category: 'Contacts',
    description: 'Triggers when a new contact is added to your database via form or integration.',
    Icon: UserPlus,
    tone: 'bg-orange-50 text-orange-700',
  },
  {
    id: 'tag_added',
    title: 'Tag Added',
    category: 'Contacts',
    description: 'Triggers when a specific organizational tag is applied to a contact profile.',
    Icon: Tag,
    tone: 'bg-fuchsia-50 text-fuchsia-700',
  },
  {
    id: 'form_submitted',
    title: 'Form Submitted',
    category: 'Custom Events',
    description: 'Triggers when a user successfully completes and submits a designated web form.',
    Icon: FileText,
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'link_clicked',
    title: 'Link Clicked',
    category: 'Custom Events',
    description: 'Triggers when a contact clicks a specific tracked link in an email or campaign.',
    Icon: MousePointerClick,
    tone: 'bg-slate-100 text-slate-700',
  },
];

function DelayModal({ isOpen, onClose, onSubmit, currentDelay, isIndependent: initialIndependent, targetTime: initialTargetTime }) {
  const [d, setD] = useState(0);
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [isIndependent, setIsIndependent] = useState(false);
  const [targetTime, setTargetTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      setD(Math.floor((currentDelay || 0) / (24 * 60)));
      setH(Math.floor(((currentDelay || 0) % (24 * 60)) / 60));
      setM((currentDelay || 0) % 60);
      setIsIndependent(!!initialIndependent);
      setTargetTime(initialTargetTime || '');
    }
  }, [isOpen, currentDelay, initialIndependent, initialTargetTime]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set Workflow Orchestration"
    >
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-800">Auto-execute on stage entry</div>
            <div className="text-[10px] text-slate-500 font-medium">Link this workflow to the previous one in the sequence.</div>
          </div>
          <button
            onClick={() => setIsIndependent(!isIndependent)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              !isIndependent ? "bg-blue-600" : "bg-slate-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                !isIndependent ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {!isIndependent ? (
          <>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
              Specify how long to wait <strong>after</strong> the previous workflow finishes before starting this one.
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Days</label>
                <Input
                  type="number"
                  min="0"
                  value={d}
                  onChange={(e) => setD(Math.max(0, parseInt(e.target.value || 0)))}
                  className="text-center font-bold text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Hours</label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={h}
                  onChange={(e) => setH(Math.min(23, Math.max(0, parseInt(e.target.value || 0))))}
                  className="text-center font-bold text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Minutes</label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={m}
                  onChange={(e) => setM(Math.min(59, Math.max(0, parseInt(e.target.value || 0))))}
                  className="text-center font-bold text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-tight">Daily Execution Window</div>
                  <div className="text-[10px] text-slate-500 font-medium">Wait until this time of day (optional)</div>
                </div>
                {targetTime && (
                  <button
                    onClick={() => setTargetTime('')}
                    className="text-[10px] text-red-500 font-bold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <Input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="bg-slate-50 border-slate-200 font-mono font-bold text-slate-700"
              />
            </div>
          </>
        ) : (
          <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700 leading-relaxed italic text-center">
            This workflow is now <strong>Independent</strong>. It will remain in this stage but won't trigger automatically when a lead enters.
          </div>
        )}

        <div className="flex justify-between items-center py-2 px-1 border-t border-slate-100 pt-6">
          <div className="text-xs text-slate-400 font-medium italic">
            {!isIndependent ? (
              <div className="flex flex-col gap-0.5">
                <div>Wait: <span className="text-blue-600 font-bold not-italic">{formatDelay(d * 1440 + h * 60 + m)}</span></div>
                {targetTime && <div className="text-[10px] text-slate-400">Trigger at: <span className="text-slate-700 font-bold not-italic font-mono">{targetTime}</span></div>}
              </div>
            ) : (
              <span className="text-purple-600 font-bold not-italic font-mono uppercase tracking-tighter">Unlinked From Sequence</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => onSubmit(d * 1440 + h * 60 + m, isIndependent, targetTime || null)}>Save Orchestration</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CreateStageModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0f172a');
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), color: color || null, is_closed: isClosed });
      setName('');
      setColor('#0f172a');
      setIsClosed(false);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100" style={{ color: '#111827' }}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-900">Create Stage</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stage name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New, Contacted, Qualified"
              autoFocus
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
            <input
              type="color"
              className="h-10 w-16 p-0 border border-slate-200 rounded"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} />
            Closed stage
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : 'Create Stage'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditWorkflowModal({ isOpen, onClose, onSubmit, workflow }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name || '');
      setDescription(workflow.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [workflow]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ ...workflow, name, description });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100" style={{ color: '#111827' }}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-900">Edit Workflow</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Lead Follow-up"
              autoFocus
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TriggerChooserView({ selectedTrigger, selectedTab, onSelectTab, onSelectTrigger, onCancel, onBuild }) {
  const visibleTriggers = workflowTriggerOptions.filter((item) => selectedTab === 'All Triggers' || item.category === selectedTab);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f3f1f8]">
      <div className="mx-auto max-w-6xl px-6 py-7">
        <button
          onClick={onCancel}
          className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-600 transition-colors hover:text-purple-800"
        >
          <ArrowLeft size={15} />
          Back to workflows
        </button>

        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Choose a Trigger</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">Select the event that will start this automation.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="h-11 rounded-2xl border-purple-100 bg-white px-5 font-semibold text-slate-700 shadow-sm hover:bg-purple-50 hover:text-purple-700"
            >
              Cancel
            </Button>
            <Button
              onClick={onBuild}
              className="h-11 rounded-2xl bg-gradient-to-r from-[#9200cc] to-[#4b0078] px-5 font-semibold text-white shadow-xl shadow-purple-300/40 hover:from-purple-700 hover:to-purple-950"
            >
              Build Workflow
            </Button>
          </div>
        </div>

        <div className="mb-7 flex flex-wrap gap-2 border-b border-purple-100">
          {triggerTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              className={cn(
                'relative px-4 pb-3 text-sm font-semibold transition-colors',
                selectedTab === tab ? 'text-purple-700' : 'text-slate-500 hover:text-purple-700'
              )}
            >
              {tab}
              {selectedTab === tab && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-full bg-purple-600" />}
            </button>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleTriggers.map((trigger) => {
            const Icon = trigger.Icon;
            const isSelected = selectedTrigger?.id === trigger.id;
            return (
              <button
                key={trigger.id}
                onClick={() => onSelectTrigger(trigger)}
                className={cn(
                  'group min-h-[172px] rounded-[24px] border bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100',
                  isSelected ? 'border-purple-500 ring-4 ring-purple-100' : 'border-white hover:border-purple-200'
                )}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${trigger.tone}`}>
                    <Icon size={20} />
                  </div>
                  {isSelected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-300">
                      <ShieldCheck size={15} />
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-950 group-hover:text-purple-700">{trigger.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{trigger.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BuilderChoiceModal({ stage, onClose, onQuickBuilder, onVisualBuilder }) {
  if (!stage) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Create workflow</h2><p className="mt-1 text-sm text-slate-500">Choose how you want to build the workflow for {stage.name}.</p></div><button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => onQuickBuilder(stage)} className="rounded-lg border border-slate-200 p-5 text-left transition hover:border-purple-300 hover:bg-purple-50"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700"><ListTree size={20} /></div><h3 className="mt-4 text-sm font-semibold text-slate-950">Quick Builder</h3><p className="mt-1 text-sm leading-5 text-slate-500">Create a trigger, messages, templates and delays as simple ordered steps.</p></button><button onClick={() => onVisualBuilder(stage)} className="rounded-lg border border-slate-200 p-5 text-left transition hover:border-purple-300 hover:bg-purple-50"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><PanelsTopLeft size={20} /></div><h3 className="mt-4 text-sm font-semibold text-slate-950">Visual Builder</h3><p className="mt-1 text-sm leading-5 text-slate-500">Use the full existing canvas for drag-and-drop logic, branches and advanced nodes.</p></button></div></div></div>;
}

export default function WorkflowsKanban({ currentUser, onOpenBuilder, onOpenQuickBuilder, onNavigate, onLogout }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    return ids[0] || null;
  }, [currentUser]);

  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [createModal, setCreateModal] = useState({ isOpen: false, stageId: null, stageName: null });
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [openStageMenuId, setOpenStageMenuId] = useState(null);
  const [openWorkflowMenuId, setOpenWorkflowMenuId] = useState(null);
  const [editWorkflow, setEditWorkflow] = useState(null);
  const [delayModal, setDelayModal] = useState({ isOpen: false, stageId: null, workflowId: null, currentDelay: 0, isIndependent: false, targetTime: null });
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'table'
  const [viewHistoryWorkflow, setViewHistoryWorkflow] = useState(null);
  const [duplicateToast, setDuplicateToast] = useState(null); // { id, name }
  const duplicateToastTimer = useRef(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [showTriggerChooser, setShowTriggerChooser] = useState(false);
  const [triggerTab, setTriggerTab] = useState('All Triggers');
  const [selectedTrigger, setSelectedTrigger] = useState(workflowTriggerOptions[0]);
  const [builderChoiceStage, setBuilderChoiceStage] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getWorkflowsKanban(teamId);
      if (res && Array.isArray(res.columns)) {
        setColumns(res.columns);
        setError(null);
      } else {
        setColumns([]);
        setError('Failed to load kanban');
      }
    } catch (e) {
      setError('Failed to load kanban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [teamId]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target && typeof e.target.closest === 'function') {
        if (e.target.closest('[data-kanban-menu]')) return;
      }
      setOpenStageMenuId(null);
      setOpenWorkflowMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDragStart = (workflowId, fromStageId) => {
    setDragItem({ workflowId, fromStageId });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (toStageId, toIndex) => {
    if (!dragItem) return;
    const { workflowId, fromStageId } = dragItem;

    const newColumns = [...columns];
    const sourceCol = newColumns.find(c => c.stage.id === fromStageId);
    const destCol = newColumns.find(c => c.stage.id === toStageId);

    if (sourceCol && destCol) {
      const workflowIndex = sourceCol.workflows.findIndex(w => w.id === workflowId);
      if (workflowIndex > -1) {
        const [workflow] = sourceCol.workflows.splice(workflowIndex, 1);
        destCol.workflows.splice(toIndex, 0, workflow);
        setColumns(newColumns);
      }
    }

    const moves = [{ workflowId, toStageId, toPosition: toIndex + 1 }];
    try {
      await reorderStageWorkflows(moves);
    } catch (e) {
      console.error("Failed to save reorder", e);
      load();
    }
    setDragItem(null);
  };

  const openCreateModal = (stageId, stageName) => {
    setBuilderChoiceStage({ id: stageId, name: stageName });
  };

  const openVisualBuilder = (stageId, stageName) => {
    setCreateModal({ isOpen: false, stageId, stageName });
    setSelectedTrigger(workflowTriggerOptions[0]);
    setTriggerTab('All Triggers');
    setShowTriggerChooser(true);
  };

  

  const handleDeleteStage = async (stage) => {
    const ok = await confirmAction({
      title: 'Delete workflow stage?',
      message: `Delete stage "${stage.name}"?`,
      confirmLabel: 'Delete stage',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteLeadStage(stage.id, teamId);
      setOpenStageMenuId(null);
      await load();
    } catch (e) {
      setError('Failed to delete stage');
    }
  };

  const handleUpdateDelay = async (delayMinutes, isIndependent, targetTime) => {
    try {
      await updateWorkflowDelay(delayModal.stageId, delayModal.workflowId, delayMinutes, isIndependent, targetTime);
      setDelayModal({ isOpen: false, stageId: null, workflowId: null, currentDelay: 0, isIndependent: false, targetTime: null });
      await load();
    } catch (e) {
      console.error('Failed to update delay:', e);
    }
  };

  const handleCreateStageSubmit = async (payload) => {
    await createLeadStage(payload, teamId);
    await load();
  };

  const handleToggleWorkflowStatus = async (workflowId, nextStatus) => {
    const ok = await confirmAction({
      title: nextStatus === 'active' ? 'Activate workflow?' : 'Pause workflow?',
      message: nextStatus === 'active'
        ? 'This workflow will become active for matching triggers.'
        : 'This workflow will stop running until activated again.',
      confirmLabel: nextStatus === 'active' ? 'Activate' : 'Pause',
      tone: 'toggle',
    });
    if (!ok) return;
    try {
      await updateWorkflow(workflowId, { status: nextStatus });
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          workflows: c.workflows.map((w) => (w.id === workflowId ? { ...w, status: nextStatus } : w)),
        }))
      );
      setOpenWorkflowMenuId(null);
    } catch (e) {
      setError('Failed to update workflow');
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    const ok = await confirmAction({
      title: 'Delete workflow?',
      message: 'Delete this workflow?',
      confirmLabel: 'Delete workflow',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteWorkflow(workflowId);
      setOpenWorkflowMenuId(null);
      await load();
    } catch (e) {
      setError('Failed to delete workflow');
    }
  };

  const handleEditWorkflowSubmit = async (updatedData) => {
    try {
      await updateWorkflow(updatedData.id, {
        name: updatedData.name,
        description: updatedData.description
      });
      await load();
      setEditWorkflow(null);
    } catch (e) {
      setError('Failed to update workflow');
    }
  };

  const handleDuplicateWorkflow = async (stageId, workflowId) => {
    try {
      const wf = await getWorkflow(workflowId);
      if (!wf) return;

      let sourceKanbanWf = null;
      columns.forEach(c => {
        const found = c.workflows.find(w => w.id === workflowId);
        if (found) sourceKanbanWf = found;
      });

      const nameBase = (wf.name ? wf.name : 'Workflow').trim();
      const copyName = `${nameBase} (Copy)`;
      const created = await createWorkflow({
        name: copyName,
        description: wf.description || '',
        status: 'inactive',
        nodes: wf.nodes ? structuredClone(wf.nodes) : [],
        edges: wf.edges ? structuredClone(wf.edges) : [],
        trigger: wf.trigger ? structuredClone(wf.trigger) : null,
        stageId,
      });

      if (sourceKanbanWf && created && created.id) {
        await updateWorkflowDelay(
          stageId,
          created.id,
          sourceKanbanWf.delayMinutes || 0,
          sourceKanbanWf.isIndependent || false,
          sourceKanbanWf.targetTime || null
        );
      }

      setOpenWorkflowMenuId(null);
      await load();

      // Show "Activate Now" toast — no need to navigate anywhere
      if (created && created.id) {
        const copyName = `${(wf.name || 'Workflow').trim()} (Copy)`;
        if (duplicateToastTimer.current) clearTimeout(duplicateToastTimer.current);
        setDuplicateToast({ id: created.id, name: copyName });
        duplicateToastTimer.current = setTimeout(() => setDuplicateToast(null), 8000);
      }
    } catch (e) {
      setError('Failed to duplicate workflow');
    }
  };

  const handleActivateFromToast = async () => {
    if (!duplicateToast) return;
    try {
      await updateWorkflow(duplicateToast.id, { status: 'active' });
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          workflows: c.workflows.map((w) =>
            w.id === duplicateToast.id ? { ...w, status: 'active' } : w
          ),
        }))
      );
    } catch (e) {
      setError('Failed to activate workflow');
    } finally {
      if (duplicateToastTimer.current) clearTimeout(duplicateToastTimer.current);
      setDuplicateToast(null);
    }
  };

  if (loading && columns.length === 0) {
    return (
      <GreetoLoader fullScreen label="Loading workflows..." sublabel="Preparing workflow board" />
    );
  }

  if (showTriggerChooser) {
    return (
      <TriggerChooserView
        selectedTrigger={selectedTrigger}
        selectedTab={triggerTab}
        onSelectTab={setTriggerTab}
        onSelectTrigger={setSelectedTrigger}
        onCancel={() => {
          setShowTriggerChooser(false);
          setCreateModal((prev) => ({ ...prev, isOpen: false }));
        }}
                onBuild={async () => {
          if (!createModal.stageId) return;
          try {
            const data = {
              name: `${selectedTrigger?.title || 'New'} Workflow`,
              description: '',
              triggerType: selectedTrigger?.id || '',
              triggerTitle: selectedTrigger?.title || '',
            };
            const created = await createWorkflow({
              ...data,
              stageId: createModal.stageId,
              status: 'active',
              steps: {
                nodes: [
                  {
                    id: 'trigger-1',
                    type: 'trigger',
                    position: { x: 250, y: 50 },
                    data: { triggerId: selectedTrigger?.id || '', label: selectedTrigger?.title || '' },
                  }
                ],
                edges: [],
                trigger: data.triggerType,
                triggerTitle: data.triggerTitle,
              },
            });
            setShowTriggerChooser(false);
            setCreateModal({ isOpen: false, stageId: null, stageName: null });
            await load();
            if (created && created.id) {
              onOpenBuilder(created.id);
            }
          } catch (e) {
            console.error(e);
            alert("Failed to create workflow");
          }
        }}

      />
    );
  }

  // Filter workflows locally
  const filteredColumns = columns.map(col => {
    const filteredWfs = col.workflows.filter(w => {
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      const matchName = w.name.toLowerCase().includes(q);
      const matchLabel = w.steps?.triggerLabel?.toLowerCase().includes(q);
      const matchCourse = w.steps?.triggerCourse?.toLowerCase().includes(q);
      return matchName || matchLabel || matchCourse;
    });
    return { ...col, workflows: filteredWfs };
  });
  const totalWorkflows = columns.reduce((sum, col) => sum + col.workflows.length, 0);
  const activeWorkflows = columns.reduce((sum, col) => sum + col.workflows.filter(w => w.status === 'active').length, 0);
  const filteredWorkflowCount = filteredColumns.reduce((sum, col) => sum + col.workflows.length, 0);
  const stageCount = columns.length;
  const allWorkflows = columns.flatMap((col) => col.workflows.map((workflow) => ({ ...workflow, stageName: col.stage.name, stageColor: col.stage.color })));
  const automationRuns = allWorkflows.reduce((sum, workflow) => sum + Number(workflow.runCount || workflow.runsCount || workflow.metrics?.runs || 0), 0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#f6f7fb]">
      <BuilderChoiceModal
        stage={builderChoiceStage}
        onClose={() => setBuilderChoiceStage(null)}
        onQuickBuilder={(stage) => { setBuilderChoiceStage(null); onOpenQuickBuilder?.(stage); }}
        onVisualBuilder={(stage) => { setBuilderChoiceStage(null); openVisualBuilder(stage.id, stage.name); }}
      />
      <div className="mx-auto w-full max-w-[1800px] shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="border-b border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                <WorkflowIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">Workflows</h1>
                <p className="mt-0.5 text-sm text-slate-500">Build, organize and monitor customer automations.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                className="h-10 rounded-lg border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 hover:text-purple-700"
              >
                <RefreshCw size={16} className={loading ? 'mr-2 animate-spin text-purple-600' : 'mr-2 text-purple-600'} />
                Refresh
              </Button>
              <Button
                onClick={() => {
                  const firstStage = columns[0]?.stage;
                  openCreateModal(firstStage?.id || null, firstStage?.name || 'Workflow Stage');
                }}
                disabled={!columns[0]?.stage?.id}
                className="h-10 rounded-lg bg-purple-700 px-4 font-medium shadow-sm hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} className="mr-2" />
                Create Workflow
              </Button>
              <Button
                onClick={() => setIsStageModalOpen(true)}
                variant="outline"
                className="h-10 rounded-lg border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-sm hover:bg-purple-50 hover:text-purple-700"
              >
                <Plus size={16} className="mr-2" />
                Add Stage
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total Workflows', value: totalWorkflows, helper: `${stageCount} stages`, Icon: WorkflowIcon, tone: 'bg-purple-50 text-purple-700' },
            { label: 'Active Users', value: activeWorkflows, helper: 'active automations', Icon: Activity, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Automation Run', value: automationRuns || activeWorkflows, helper: 'from workflow data', Icon: Zap, tone: 'bg-blue-50 text-blue-700' },
            { label: 'Efficiency Score', value: totalWorkflows ? `${Math.round((activeWorkflows / totalWorkflows) * 100)}%` : '0%', helper: 'active ratio', Icon: ShieldCheck, tone: 'bg-fuchsia-50 text-fuchsia-700' },
          ].map(({ label, value, helper, Icon, tone }) => (
            <div key={label} className="flex min-h-[104px] items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-purple-200 hover:shadow-md">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 text-2xl font-semibold text-slate-950">{value}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{helper}</p>
              </div>
            </div>
          ))}
        </div>

        {columns.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-violet-200 bg-white px-5 py-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Start your automation workspace</p>
            <p className="mt-1 text-sm text-slate-500">Create a workflow stage first, then add triggers, delays, templates, and actions.</p>
            <Button onClick={() => setIsStageModalOpen(true)} className="mt-4 h-10 rounded-lg bg-violet-600 px-4 font-medium text-white hover:bg-violet-700"><Plus size={16} className="mr-2" />Add first stage</Button>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:w-[420px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by name, tag, course..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-purple-50 hover:text-purple-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <ViewToggle value={viewMode} onChange={setViewMode} boardValue="kanban" tableValue="table" />
          </div>
        </div>

      </div>

      <div className="mx-auto w-full max-w-[1800px] overflow-x-auto overflow-y-visible px-4 pb-8 pt-4 sm:px-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {viewMode === 'table' ? (
           <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-sm">
             <Table>
               <TableHeader>
                 <TableRow className="border-purple-50 bg-purple-50/60 hover:bg-purple-50/60">
                   <TableHead className="w-[300px] font-bold uppercase tracking-[0.16em] text-purple-500">Workflow Name</TableHead>
                   <TableHead className="font-bold uppercase tracking-[0.16em] text-purple-500">Stage</TableHead>
                   <TableHead className="font-bold uppercase tracking-[0.16em] text-purple-500">Course Filter</TableHead>
                   <TableHead className="font-bold uppercase tracking-[0.16em] text-purple-500">Tag Filter</TableHead>
                   <TableHead className="text-center font-bold uppercase tracking-[0.16em] text-purple-500">Status</TableHead>
                   <TableHead className="text-right font-bold uppercase tracking-[0.16em] text-purple-500 pr-8">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredColumns.flatMap(col => col.workflows.map(w => (
                   <TableRow key={w.id} className="group border-b border-purple-50 transition-all last:border-0 hover:bg-purple-50/40">
                     <TableCell className="py-4">
                       <div className="flex flex-col">
                         <span className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition-colors uppercase tracking-tight">{w.name}</span>
                         {w.description && <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{w.description}</span>}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-700">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.stage.color || '#0f172a' }} />
                          {col.stage.name}
                       </div>
                     </TableCell>
                     <TableCell>
                        <span className="text-xs font-semibold text-slate-600">{(w.steps?.triggerCourse || w.triggerCourse) || '—'}</span>
                     </TableCell>
                     <TableCell>
                        <span className="text-xs font-semibold text-slate-600">{(w.steps?.triggerLabel || w.triggerLabel) || '—'}</span>
                     </TableCell>
                     <TableCell className="text-center">
                        <Badge variant={w.status === 'active' ? 'success' : 'secondary'} className="uppercase text-[9px] font-bold px-2 py-0.5 tracking-widest">
                          {w.status}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-slate-400 hover:bg-purple-50 hover:text-purple-700"
                            onClick={async () => {
                              try {
                                const wf = await getWorkflow(w.id);
                                if (wf && wf.id && onOpenBuilder) onOpenBuilder(wf);
                              } catch (e) { console.error(e); }
                            }}
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-slate-400 hover:bg-purple-50 hover:text-purple-700"
                            onClick={() => setEditWorkflow(w)}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleDeleteWorkflow(w.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                     </TableCell>
                   </TableRow>
                 )))}
               </TableBody>
             </Table>
           </div>
        ) : (
          <div className="flex min-h-[560px] gap-5 pb-2">
          {filteredColumns.map((col) => (
            <div key={col.stage.id} className="flex min-h-[520px] w-80 flex-shrink-0 flex-col">
              <div className="mb-3 flex items-center justify-between rounded-3xl border border-white bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white"
                    style={{ backgroundColor: col.stage.color || '#0f172a' }}
                  />
                  <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    {col.stage.name}
                  </span>
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
                    {col.workflows.length}
                  </span>
                </div>
                <div className="relative" data-kanban-menu>
                  <button
                    className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenStageMenuId((v) => (v === col.stage.id ? null : col.stage.id));
                      setOpenWorkflowMenuId(null);
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {openStageMenuId === col.stage.id && (
                    <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-xl shadow-purple-100">
                      <button
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-purple-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenStageMenuId(null);
                          setIsStageModalOpen(true);
                        }}
                      >
                        Add stage
                      </button>
                      <button
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteStage(col.stage);
                        }}
                      >
                        Delete stage
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="relative group flex min-h-[430px] flex-col gap-3 rounded-[28px] border border-white bg-white/70 p-3 shadow-inner shadow-purple-50"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                   e.preventDefault();
                   handleDrop(col.stage.id, col.workflows.length);
                }}
              >
                {col.workflows.map((w, idx) => (
                  <React.Fragment key={w.id}>
                    <div
                      key={w.id}
                      className={`group/card relative cursor-grab rounded-3xl border border-white bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-100 hover:shadow-xl hover:shadow-purple-100 active:cursor-grabbing ${openWorkflowMenuId === w.id ? 'z-30' : 'z-0'}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        handleDragStart(w.id, col.stage.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop(col.stage.id, idx);
                      }}
                      onClick={async () => {
                        try {
                          const wf = await getWorkflow(w.id);
                          if (wf && wf.id && onOpenBuilder) onOpenBuilder({ ...wf, stageName: col.stage.name });
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-bold leading-snug text-slate-900 transition-colors hover:text-purple-700">
                          {w.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="cursor-move text-slate-300 group-hover/card:text-slate-400">
                            <GripVertical size={14} />
                          </div>
                          <div className="relative opacity-0 group-hover/card:opacity-100 transition-opacity" data-kanban-menu>
                            <button
                              className="rounded-xl p-1 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-700"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenWorkflowMenuId((v) => (v === w.id ? null : w.id));
                                setOpenStageMenuId(null);
                              }}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            {openWorkflowMenuId === w.id && (
                              <div className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-xl shadow-purple-100">
                                <button
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-purple-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditWorkflow(w);
                                    setOpenWorkflowMenuId(null);
                                  }}
                                >
                                  Edit details
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-purple-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const steps = w.steps || {};
                                    const triggerLabel = steps.triggerLabel || w.triggerLabel;
                                    const triggerCourse = steps.triggerCourse || w.triggerCourse;
                                    onOpenBuilder({ ...w, stageName: col.stage.name });
                                    setOpenWorkflowMenuId(null);
                                  }}
                                >
                                  Open builder
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-purple-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const nextStatus = w.status === 'active' ? 'inactive' : 'active';
                                    handleToggleWorkflowStatus(w.id, nextStatus);
                                  }}
                                >
                                  {w.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-purple-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDuplicateWorkflow(col.stage.id, w.id);
                                  }}
                                >
                                  Duplicate
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteWorkflow(w.id);
                                  }}
                                >
                                  Delete workflow
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setViewHistoryWorkflow(w);
                                  }}
                                >
                                  View History
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {w.description && (
                        <div className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {w.description}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge
                          variant="outline"
                          className={`h-5 px-1.5 py-0 text-[10px] shadow-sm ${w.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}
                        >
                          {w.status}
                        </Badge>

                        {w.isIndependent && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-tighter">
                            Unlinked
                          </Badge>
                        )}

                        {(w.steps?.triggerCourse || w.triggerCourse) && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200 truncate max-w-[80px]">
                            {w.steps?.triggerCourse || w.triggerCourse}
                          </Badge>
                        )}

                        {(w.steps?.triggerLabel || w.triggerLabel) && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200 truncate max-w-[80px]">
                            {w.steps?.triggerLabel || w.triggerLabel}
                          </Badge>
                        )}

                        <span className="text-[10px] text-slate-400 font-mono ml-auto opacity-60">#{idx + 1}</span>
                      </div>
                    </div>

                    {idx < col.workflows.length - 1 && (
                      <div className="flex flex-col items-center py-1 group/delay relative h-10 -my-1 justify-center">
                        <div className={cn(
                          "w-px h-full border-l-2 border-dashed transition-colors",
                          col.workflows[idx + 1].isIndependent ? "border-transparent" : "border-slate-200 group-hover/delay:border-blue-200"
                        )} />

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDelayModal({
                              isOpen: true,
                              stageId: col.stage.id,
                              workflowId: col.workflows[idx + 1].id,
                              currentDelay: col.workflows[idx + 1].delayMinutes,
                              isIndependent: col.workflows[idx + 1].isIndependent,
                              targetTime: col.workflows[idx + 1].targetTime
                            });
                          }}
                          className={cn(
                            "absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm transition-all z-10",
                            col.workflows[idx + 1].isIndependent
                              ? "bg-slate-100 border-slate-200 text-slate-400 hover:bg-white hover:border-purple-300 hover:text-purple-600"
                              : (col.workflows[idx + 1].delayMinutes > 0 || col.workflows[idx + 1].targetTime)
                                ? "bg-blue-600 border-blue-700 text-white hover:bg-blue-700"
                                : "bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:scale-105"
                          )}
                        >
                          <Clock size={12} className={(!col.workflows[idx + 1].isIndependent && (col.workflows[idx + 1].delayMinutes > 0 || col.workflows[idx + 1].targetTime)) ? "animate-pulse" : ""} />
                          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                            {col.workflows[idx + 1].isIndependent
                              ? 'No Link'
                              : (col.workflows[idx + 1].delayMinutes > 0 ? formatDelay(col.workflows[idx + 1].delayMinutes) : '') +
                                (col.workflows[idx + 1].targetTime ? (col.workflows[idx + 1].delayMinutes > 0 ? ' @ ' : '@ ') + col.workflows[idx + 1].targetTime : (col.workflows[idx + 1].delayMinutes === 0 ? 'Instant' : ''))}
                          </span>
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                ))}

                {col.workflows.length === 0 && (
                  <div className="m-1 flex flex-1 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-purple-100 bg-purple-50/40 py-8 text-slate-400">
                    <span className="text-xs font-bold">No workflows</span>
                    <span className="text-[10px] opacity-70 mt-1">Drop here or create new</span>
                  </div>
                )}

                <button
                  onClick={() => openCreateModal(col.stage.id, col.stage.name)}
                  className="mt-auto flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-transparent py-2.5 text-sm font-bold text-slate-500 transition-all hover:border-purple-100 hover:bg-purple-50 hover:text-purple-700"
                >
                  <Plus size={16} />
                  <span>Add Workflow</span>
                </button>
              </div>
            </div>
          ))}

          <div className="flex min-h-[520px] w-80 flex-shrink-0 flex-col opacity-80 transition-opacity hover:opacity-100">
            <div className="h-10 mb-3"></div>
            <button
              onClick={() => setIsStageModalOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-purple-200 bg-white/70 text-purple-600 transition-all hover:border-purple-300 hover:bg-purple-50"
            >
              <Plus size={24} />
              <span className="font-bold">Add New Stage</span>
            </button>
          </div>
          </div>
        )}
      </div>

      <CreateStageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        onSubmit={handleCreateStageSubmit}
      />
      <EditWorkflowModal
        isOpen={!!editWorkflow}
        onClose={() => setEditWorkflow(null)}
        onSubmit={handleEditWorkflowSubmit}
        workflow={editWorkflow}
      />
      <DelayModal
        isOpen={delayModal.isOpen}
        onClose={() => setDelayModal({ ...delayModal, isOpen: false })}
        onSubmit={handleUpdateDelay}
        currentDelay={delayModal.currentDelay}
        isIndependent={delayModal.isIndependent}
        targetTime={delayModal.targetTime}
      />
      {viewHistoryWorkflow && (
        <RunsHistoryPanel
          workflow={viewHistoryWorkflow}
          onClose={() => setViewHistoryWorkflow(null)}
        />
      )}

      {/* ── Duplicate "Activate Now" Toast ── */}
      {duplicateToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-2xl border border-green-200 bg-white px-5 py-3.5 shadow-2xl shadow-green-100"
          style={{ minWidth: 340, maxWidth: 500 }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
            <Check size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">"{duplicateToast.name}" created!</p>
            <p className="text-xs text-slate-500 mt-0.5">Workflow is inactive. Activate it now?</p>
          </div>
          <button
            onClick={handleActivateFromToast}
            className="shrink-0 rounded-xl bg-green-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-green-700 transition-colors"
          >
            Activate Now
          </button>
          <button
            onClick={() => { if (duplicateToastTimer.current) clearTimeout(duplicateToastTimer.current); setDuplicateToast(null); }}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}


