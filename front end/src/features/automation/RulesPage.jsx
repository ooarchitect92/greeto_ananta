'use strict';
import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  Zap,
  Workflow,
  Bell,
  MessageSquareText,
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Sparkles,
  Search,
  ArrowLeft,
  ShieldCheck,
  Route,
  ListChecks,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import { getRules, createRule, updateRule, deleteRule, getWorkflows } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

const actionIcons = {
  send_message: MessageSquareText,
  notify_admin: Bell,
  start_workflow: Workflow,
  assign_agent: UserCheck,
};

function getActionLabel(rule, workflows) {
  const cfg = rule.action_config || {};
  if (rule.action_type === 'send_message') return `Send message: ${cfg.message || cfg.text || ''}`;
  if (rule.action_type === 'notify_admin') return `Notify admin: ${cfg.message || cfg.text || ''}`;
  if (rule.action_type === 'assign_agent') return `Assign agent (Course: ${cfg.course || 'Any'}, Lang: ${cfg.language || 'Any'})`;
  const workflow = workflows.find((w) => String(w.id) === String(cfg.workflow_id));
  return `Start workflow${workflow ? `: ${workflow.name}` : ''}`;
}

function getWhenLabel(rule) {
  if (rule.event_type === 'message_text') return `User message contains "${rule.match_value}"`;
  return `Course equals "${rule.match_value}"`;
}

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    event_type: 'message_text',
    match_value: '',
    action_type: 'send_message',
    message: '',
    workflow_id: '',
    course: '',
    language: '',
  });

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await getRules();
      if (Array.isArray(data)) {
        setRules(data);
        setError(null);
      } else {
        setRules([]);
        setError((data && (data.error || data.message)) || 'Failed to load rules');
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
      setError('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      setLoadingWorkflows(true);
      const data = await getWorkflows();
      if (Array.isArray(data)) {
        setWorkflows(data);
      } else {
        setWorkflows([]);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      setWorkflows([]);
    } finally {
      setLoadingWorkflows(false);
    }
  };

  useEffect(() => {
    loadRules();
    loadWorkflows();
  }, []);

  const openModal = (rule = null) => {
    if (rule) {
      const cfg = rule.action_config || {};
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        is_active: rule.is_active,
        event_type: rule.event_type,
        match_value: rule.match_value,
        action_type: rule.action_type,
        message: cfg.message || cfg.text || '',
        workflow_id: cfg.workflow_id || '',
        course: cfg.course || '',
        language: cfg.language || '',
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        is_active: true,
        event_type: 'message_text',
        match_value: '',
        action_type: 'send_message',
        message: '',
        workflow_id: '',
        course: '',
        language: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description || null,
      is_active: formData.is_active,
      event_type: formData.event_type,
      match_value: formData.match_value,
      action_type: formData.action_type,
      action_config:
        formData.action_type === 'send_message' || formData.action_type === 'notify_admin'
          ? { message: formData.message }
          : formData.action_type === 'assign_agent'
            ? { course: formData.course, language: formData.language }
            : { workflow_id: formData.workflow_id },
    };

    try {
      if (editingRule) {
        await updateRule(editingRule.id, payload);
      } else {
        await createRule(payload);
      }
      closeModal();
      loadRules();
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction({
      title: 'Delete rule?',
      message: 'Are you sure you want to delete this rule?',
      confirmLabel: 'Delete rule',
      tone: 'danger',
    }))) return;
    try {
      await deleteRule(id);
      loadRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const activeRules = rules.filter((rule) => rule.is_active).length;
  const workflowRules = rules.filter((rule) => rule.action_type === 'start_workflow').length;
  const assignmentRules = rules.filter((rule) => rule.action_type === 'assign_agent').length;
  const filteredRules = rules.filter((rule) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      rule.name,
      rule.description,
      rule.event_type,
      rule.match_value,
      rule.action_type,
      getActionLabel(rule, workflows),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });

  if (loading && rules.length === 0) {
    return (
      <GreetoLoader fullScreen label="Loading automation rules..." sublabel="Preparing rule engine controls" />
    );
  }

  if (isModalOpen) {
    return (
      <div className="min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_34%),#f6f2fb]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/70 sm:p-6">
            <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-fuchsia-100/80 blur-3xl" />
            <div className="pointer-events-none absolute -left-24 bottom-0 h-52 w-52 rounded-full bg-purple-100/70 blur-3xl" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-white text-purple-700 shadow-sm transition hover:-translate-x-0.5 hover:bg-purple-50 sm:h-12 sm:w-12"
                  aria-label="Back to automation rules"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-500 text-white shadow-xl shadow-purple-200 sm:h-16 sm:w-16 sm:rounded-2xl">
                  <Zap className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  {/* <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Rule Builder
                  </p> */}
                  <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                    {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Configure the trigger, match value, action, and live status in one focused page.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <Button type="button" variant="outline" onClick={closeModal} className="h-11 rounded-xl border-purple-100 bg-white px-4 sm:h-12 sm:rounded-2xl sm:px-5">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="automation-rule-form"
                  className="h-11 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-4 shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700 sm:h-12 sm:rounded-2xl sm:px-5"
                >
                  {editingRule ? 'Save Changes' : 'Create Rule'}
                </Button>
              </div>
            </div>
          </div>

          <form id="automation-rule-form" onSubmit={handleSubmit} className="mt-4 grid min-w-0 gap-4 lg:mt-6 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)] lg:gap-6">
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:space-y-6">
              <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-500">Live Preview</p>
                <div className="mt-4 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-4 sm:mt-5 sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-700 to-fuchsia-500 text-white shadow-lg shadow-purple-100 sm:h-12 sm:w-12 sm:rounded-2xl">
                      {React.createElement(actionIcons[formData.action_type] || Zap, { className: 'h-5 w-5' })}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-950">{formData.name || 'Untitled rule'}</h2>
                      <p className="mt-1 text-sm text-slate-500">{formData.description || 'No description added yet.'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:mt-5">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-500">When</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                        {formData.event_type === 'message_text' ? 'User message contains' : 'Course equals'} {formData.match_value ? `"${formData.match_value}"` : 'a value'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-500">Then</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                        {formData.action_type === 'send_message'
                          ? `Send message${formData.message ? `: ${formData.message}` : ''}`
                          : formData.action_type === 'notify_admin'
                            ? `Notify admin${formData.message ? `: ${formData.message}` : ''}`
                            : formData.action_type === 'assign_agent'
                              ? 'Assign agent by course/language'
                              : 'Start selected workflow'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-100 sm:p-5">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-purple-600"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <div>
                  <p className="text-base font-semibold text-slate-950">Rule is active</p>
                  <p className="text-sm text-slate-500">Run this automation as soon as the condition matches.</p>
                </div>
              </label>
            </div>

            <div className="min-w-0 space-y-4 lg:space-y-6">
              <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-500">Rule Details</p>
                <div className="mt-4 grid gap-4 md:mt-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">Name</label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Greet on hi"
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 focus-visible:ring-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">When</label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold outline-none transition focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                      value={formData.event_type}
                      onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    >
                      <option value="message_text">User message contains text</option>
                      <option value="course_equals">Course equals value</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800">Description</label>
                    <textarea
                      className="min-h-[88px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional: explain what this rule does"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800">Match value</label>
                    <Input
                      required
                      value={formData.match_value}
                      onChange={(e) => setFormData({ ...formData, match_value: e.target.value })}
                      placeholder={formData.event_type === 'message_text' ? 'e.g. hi, cpa, cma' : 'e.g. CPA, CMA'}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 focus-visible:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-500">Action</p>
                <div className="mt-4 grid gap-4 md:mt-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">Then</label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold outline-none transition focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                      value={formData.action_type}
                      onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                    >
                      <option value="send_message">Send message</option>
                      <option value="notify_admin">Notify Admin</option>
                      <option value="start_workflow">Start workflow</option>
                      <option value="assign_agent">Assign Agent</option>
                    </select>
                  </div>

                  {formData.action_type === 'send_message' || formData.action_type === 'notify_admin' ? (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-slate-800">
                        {formData.action_type === 'send_message' ? 'Message to send' : 'Notification message'}
                      </label>
                      <textarea
                        className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder={formData.action_type === 'send_message' ? 'Type the reply message' : 'Type the admin alert message'}
                      />
                    </div>
                  ) : formData.action_type === 'assign_agent' ? (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-slate-800">Assignment Conditions</label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                          placeholder="Course"
                          value={formData.course || ''}
                          onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        />
                        <input
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                          placeholder="Language"
                          value={formData.language || ''}
                          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-slate-800">Workflow to start</label>
                      <select
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold outline-none transition focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                        value={formData.workflow_id}
                        onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                      >
                        <option value="">Select workflow...</option>
                        {workflows.map((wf) => (
                          <option key={wf.id} value={wf.id}>{wf.name}</option>
                        ))}
                      </select>
                      {loadingWorkflows && <p className="text-[11px] text-slate-400">Loading workflows...</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_34%),#f6f2fb]">
      <div className="p-6">
        <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/95 p-6 shadow-sm shadow-purple-100/70">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-purple-100/80 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-fuchsia-100/60 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-500 text-white shadow-xl shadow-purple-200">
                <Zap className="h-7 w-7" />
              </div>
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Automation Control
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Automation Rules</h1>
                <p className="mt-1 text-sm text-slate-500">Create simple if-then rules for replies, routing, alerts, and workflow starts.</p>
              </div>
            </div>

            <Button
              onClick={() => openModal()}
              className="h-12 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 font-semibold shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700"
            >
              <Plus size={16} className="mr-2" />
              New Rule
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Rules', value: rules.length, Icon: ListChecks, tone: 'bg-purple-50 text-purple-700', helper: 'configured automations' },
            { label: 'Active', value: activeRules, Icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-700', helper: 'currently running' },
            { label: 'Workflow Starts', value: workflowRules, Icon: Route, tone: 'bg-blue-50 text-blue-700', helper: 'route into journeys' },
            { label: 'Assignments', value: assignmentRules, Icon: UserCheck, tone: 'bg-fuchsia-50 text-fuchsia-700', helper: 'agent routing rules' },
          ].map(({ label, value, Icon, tone, helper }) => (
            <div key={label} className="group rounded-3xl border border-white/80 bg-white/95 p-5 shadow-sm shadow-purple-100/50 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-100">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
              <p className="mt-1 text-xs text-slate-400">{helper}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Rule Library</h2>
              <p className="text-sm text-slate-500">Search, enable, edit, or remove automation rules.</p>
            </div>
            <div className="relative w-full lg:w-80">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rules..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {filteredRules.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[28px] border border-dashed border-purple-200 bg-gradient-to-br from-white to-purple-50/50 p-8 text-center shadow-sm">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-50 text-purple-600 shadow-sm">
                <Zap size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-950">{rules.length === 0 ? 'No rules yet' : 'No matching rules'}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {rules.length === 0 ? 'Create your first rule to automate replies and workflows.' : 'Try another search term or clear the filter.'}
              </p>
              {rules.length === 0 && (
                <Button onClick={() => openModal()} className="mt-5 rounded-2xl bg-purple-700 hover:bg-purple-800">
                  <Plus size={15} className="mr-2" />
                  Create Rule
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredRules.map((rule) => {
                const ActionIcon = actionIcons[rule.action_type] || Zap;
                return (
                  <div key={rule.id} className="group rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-sm shadow-purple-100/60 transition hover:-translate-y-0.5 hover:border-purple-100 hover:shadow-xl hover:shadow-purple-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-500 text-white shadow-lg shadow-purple-100 transition group-hover:scale-105">
                          <ActionIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-bold text-slate-950">{rule.name}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {rule.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{rule.description}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 transition group-hover:bg-purple-50">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-500">When</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{getWhenLabel(rule)}</p>
                      </div>
                      <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/40 p-4 transition group-hover:bg-fuchsia-50">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-500">Then</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{getActionLabel(rule, workflows)}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-purple-50 pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`rounded-xl text-xs font-bold ${rule.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
                        onClick={async () => {
                          const next = !rule.is_active;
                          const ok = await confirmAction({
                            title: next ? 'Enable rule?' : 'Disable rule?',
                            message: next
                              ? `"${rule.name}" will start running automatically when matched.`
                              : `"${rule.name}" will stop running until enabled again.`,
                            confirmLabel: next ? 'Enable rule' : 'Disable rule',
                            tone: 'toggle',
                          });
                          if (ok) updateRule(rule.id, { is_active: next }).then(loadRules);
                        }}
                      >
                        {rule.is_active ? <ToggleLeft size={15} className="mr-1" /> : <ToggleRight size={15} className="mr-1" />}
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-xs font-bold text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                        onClick={() => openModal(rule)}
                      >
                        <Pencil size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
        className="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">Name</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Greet on hi"
                className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 focus-visible:ring-purple-500"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-purple-200 hover:bg-purple-50/30">
              <input
                type="checkbox"
                className="h-4 w-4 accent-purple-600"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <div>
                <p className="text-sm font-bold text-slate-800">Rule is active</p>
                <p className="text-xs text-slate-500">Run this rule automatically when matched.</p>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-800">Description</label>
            <textarea
              className="min-h-[88px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional: explain what this rule does"
            />
          </div>

          <div className="rounded-3xl border border-purple-100 bg-purple-50/40 p-4">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-purple-500">Rule Condition</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">When</label>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                >
                  <option value="message_text">User message contains text</option>
                  <option value="course_equals">Course equals value</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Match value</label>
                <Input
                  required
                  value={formData.match_value}
                  onChange={(e) => setFormData({ ...formData, match_value: e.target.value })}
                  placeholder={formData.event_type === 'message_text' ? 'e.g. hi, cpa, cma' : 'e.g. CPA, CMA'}
                  className="h-12 rounded-2xl border-slate-200 bg-white focus-visible:ring-purple-500"
                />
                <p className="text-[11px] font-medium text-slate-500">You can use multiple values, comma separated.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-fuchsia-100 bg-fuchsia-50/30 p-4">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-500">Rule Action</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Then</label>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                  value={formData.action_type}
                  onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                >
                  <option value="send_message">Send message</option>
                  <option value="notify_admin">Notify Admin</option>
                  <option value="start_workflow">Start workflow</option>
                  <option value="assign_agent">Assign Agent</option>
                </select>
              </div>

              {formData.action_type === 'send_message' || formData.action_type === 'notify_admin' ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">
                    {formData.action_type === 'send_message' ? 'Message to send' : 'Notification message'}
                  </label>
                  <textarea
                    className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={formData.action_type === 'send_message' ? 'Type the reply message' : 'Type the admin alert message'}
                  />
                </div>
              ) : formData.action_type === 'assign_agent' ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">Assignment Conditions</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                      placeholder="Course"
                      value={formData.course || ''}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    />
                    <input
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                      placeholder="Language"
                      value={formData.language || ''}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">Assigns to available agent via round robin. Leave blank to match any.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">Workflow to start</label>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                    value={formData.workflow_id}
                    onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                  >
                    <option value="">Select workflow...</option>
                    {workflows.map((wf) => (
                      <option key={wf.id} value={wf.id}>{wf.name}</option>
                    ))}
                  </select>
                  {loadingWorkflows && <p className="text-[11px] text-slate-400">Loading workflows...</p>}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal} className="rounded-2xl px-5">
              Cancel
            </Button>
            <Button type="submit" className="rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700">
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
