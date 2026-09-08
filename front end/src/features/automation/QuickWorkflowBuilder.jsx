import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Clock3, Eye, FileText, GitBranch, GripVertical, MessageCircleQuestion, MessageSquare, Plus, Save, Send, Tag, Trash2, UserRoundCheck, Workflow } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { createWorkflow, getTemplates } from './api.js';

const TRIGGERS = [
  { value: 'new_contact', label: 'New lead is created' },
  { value: 'lead_stage_updated_webhook', label: "Lead's stage changes" },
  { value: 'tag_added', label: 'A tag is added to a lead' },
  { value: 'manual', label: 'Run manually' },
];

const newStep = (type) => {
  const id = `quick_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'delay') return { id, type, data: { label: 'Wait', minutes: 10 } };
  if (type === 'send_template') return { id, type, data: { label: 'Send template', template: '', languageCode: 'en_US' } };
  if (type === 'condition') return { id, type, data: { label: 'Condition', variablePath: 'lead.status', operator: 'eq', value: '' } };
  if (type === 'action') return { id, type, data: { label: 'Update lead', actionType: 'add_label', actionValue: '' } };
  if (type === 'wait_for_reply') return { id, type, data: { label: 'Wait for reply', timeoutMinutes: 60 } };
  return { id, type: 'send_message', data: { label: 'Send message', message: '' } };
};

const stepMeta = {
  send_message: { title: 'Send Message', Icon: MessageSquare, tone: 'bg-emerald-50 text-emerald-700' },
  send_template: { title: 'Send Template', Icon: Send, tone: 'bg-blue-50 text-blue-700' },
  delay: { title: 'Wait', Icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
  condition: { title: 'Condition', Icon: GitBranch, tone: 'bg-fuchsia-50 text-fuchsia-700' },
  action: { title: 'Lead Action', Icon: Tag, tone: 'bg-cyan-50 text-cyan-700' },
  wait_for_reply: { title: 'Wait for Reply', Icon: MessageCircleQuestion, tone: 'bg-orange-50 text-orange-700' },
};

export default function QuickWorkflowBuilder({ stage, onBack, onOpenVisualBuilder }) {
  const [name, setName] = useState('New Workflow');
  const [trigger, setTrigger] = useState('new_contact');
  const [steps, setSteps] = useState([newStep('send_message')]);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewStep, setPreviewStep] = useState(null);

  useEffect(() => {
    getTemplates().then((data) => setTemplates(Array.isArray(data) ? data : data?.templates || [])).catch(() => setTemplates([]));
  }, []);

  const triggerLabel = useMemo(() => TRIGGERS.find((item) => item.value === trigger)?.label || 'Trigger', [trigger]);

  const updateStep = (id, patch) => setSteps((current) => current.map((step) => step.id === id ? { ...step, data: { ...step.data, ...patch } } : step));
  const moveStep = (index, direction) => setSteps((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async (openVisual = false) => {
    if (!name.trim()) return setError('Enter a workflow name.');
    if (!steps.length) return setError('Add at least one action.');
    const invalidMessage = steps.some((step) => step.type === 'send_message' && !String(step.data.message || '').trim());
    const invalidTemplate = steps.some((step) => step.type === 'send_template' && !String(step.data.template || '').trim());
    const invalidCondition = steps.some((step) => step.type === 'condition' && (!String(step.data.variablePath || '').trim() || !String(step.data.value || '').trim()));
    const invalidAction = steps.some((step) => step.type === 'action' && !String(step.data.actionValue || '').trim());
    if (invalidMessage || invalidTemplate || invalidCondition || invalidAction) return setError('Complete every message, template, condition and lead action before saving.');

    setSaving(true);
    setError('');
    try {
      const triggerNode = {
        id: 'trigger_1', type: 'trigger', position: { x: 320, y: 60 },
        data: { label: triggerLabel, triggerId: trigger, triggerType: trigger },
      };
      const nodes = [triggerNode, ...steps.map((step, index) => ({ ...step, position: { x: 320, y: 180 + index * 150 } }))];
      const edges = nodes.slice(0, -1).map((node, index) => ({ id: `edge_${index}`, source: node.id, target: nodes[index + 1].id }));
      const workflow = await createWorkflow({
        name: name.trim(), description: `Quick Builder: ${triggerLabel}`, status: 'inactive',
        trigger, nodes, edges, stageId: stage?.id || null,
        steps: { trigger, nodes, edges },
      });
      if (openVisual && workflow?.id) onOpenVisualBuilder(workflow);
      else onBack();
    } catch (saveError) {
      setError(saveError?.message || 'Could not save the workflow.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"><ArrowLeft size={16} /> Back to Workflows</button>
        <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-xl font-semibold text-slate-900">{name || 'New workflow'}</h1><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Draft</span></div><p className="mt-1 text-sm text-slate-500">Create a step-by-step automation for {stage?.name || 'this workspace'}.</p></div>
          <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" onClick={() => save(true)} disabled={saving}>Open advanced canvas</Button><Button onClick={() => save(false)} disabled={saving}><Save size={16} className="mr-2" />{saving ? 'Saving...' : 'Save draft'}</Button></div>
        </header>

        <main className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow</h2>
            <label className="mt-3 block text-sm font-medium text-slate-700">Workflow name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Workflow size={16} className="text-purple-700" /><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">When this happens</h2></div>
            <label className="mt-3 block text-sm font-medium text-slate-700">Run this workflow when...</label>
            <select aria-label="Run this workflow when" value={trigger} onChange={(event) => setTrigger(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-purple-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-purple-500">
                {TRIGGERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            <p className="mt-2 text-xs text-slate-500">{triggerLabel}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Flow</h2><span className="text-xs text-slate-400">{steps.length} steps</span></div>
              <div className="mt-3 space-y-3">
                {steps.map((step, index) => {
                  const meta = stepMeta[step.type]; const Icon = meta.Icon;
                  return <div key={step.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-3"><GripVertical size={18} className="text-slate-300" /><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-500 shadow-sm">{index + 1}</span><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tone}`}><Icon size={16} /></div><button onClick={() => setPreviewStep(step)} className="min-w-0 flex-1 text-left" title="View step details"><p className="text-sm font-medium text-slate-900">{meta.title}</p></button><button onClick={() => setPreviewStep(step)} className="p-1 text-slate-400 hover:text-purple-700" title="Preview step"><Eye size={16} /></button><button onClick={() => moveStep(index, -1)} disabled={index === 0} className="p-1 text-slate-400 disabled:opacity-30" title="Move up"><ChevronUp size={16} /></button><button onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="p-1 text-slate-400 disabled:opacity-30" title="Move down"><ChevronDown size={16} /></button><button onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))} className="p-1 text-slate-400 hover:text-red-600" title="Delete step"><Trash2 size={16} /></button></div>
                    {step.type === 'send_message' && <textarea value={step.data.message} onChange={(event) => updateStep(step.id, { message: event.target.value })} placeholder="Write the WhatsApp message..." className="mt-3 min-h-24 w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />}
                    {step.type === 'send_template' && <select value={step.data.template} onChange={(event) => updateStep(step.id, { template: event.target.value })} className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-purple-500"><option value="">Select an approved template</option>{templates.map((template) => <option key={template.id || template.name} value={template.name}>{template.name}</option>)}</select>}
                    {step.type === 'delay' && <div className="mt-3 grid grid-cols-3 gap-2"><label className="text-xs text-slate-500">Days<input type="number" min="0" value={step.data.days || 0} onChange={(event) => updateStep(step.id, { days: Math.max(0, Number(event.target.value || 0)) })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /></label><label className="text-xs text-slate-500">Hours<input type="number" min="0" max="23" value={step.data.hours || 0} onChange={(event) => updateStep(step.id, { hours: Math.max(0, Number(event.target.value || 0)) })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /></label><label className="text-xs text-slate-500">Minutes<input type="number" min="0" max="59" value={step.data.minutes || 0} onChange={(event) => updateStep(step.id, { minutes: Math.max(0, Number(event.target.value || 0)) })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /></label></div>}
                    {step.type === 'condition' && <div className="mt-3 grid gap-2 sm:grid-cols-3"><input value={step.data.variablePath} onChange={(event) => updateStep(step.id, { variablePath: event.target.value })} placeholder="lead.status" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /><select value={step.data.operator} onChange={(event) => updateStep(step.id, { operator: event.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-purple-500"><option value="eq">equals</option><option value="neq">does not equal</option><option value="contains">contains</option></select><input value={step.data.value} onChange={(event) => updateStep(step.id, { value: event.target.value })} placeholder="Value" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /></div>}
                    {step.type === 'action' && <div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={step.data.actionType} onChange={(event) => updateStep(step.id, { actionType: event.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-purple-500"><option value="add_label">Add label</option><option value="remove_label">Remove label</option><option value="assign_agent">Assign agent</option><option value="update_lead_stage">Move lead stage</option></select><input value={step.data.actionValue} onChange={(event) => updateStep(step.id, { actionValue: event.target.value })} placeholder="Label, agent or stage value" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /></div>}
                    {step.type === 'wait_for_reply' && <label className="mt-3 block text-xs text-slate-500">Timeout in minutes<input type="number" min="1" value={step.data.timeoutMinutes} onChange={(event) => updateStep(step.id, { timeoutMinutes: Math.max(1, Number(event.target.value || 1)) })} className="mt-1 h-10 w-36 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" /></label>}
                  </div>;
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setSteps((current) => [...current, newStep('send_message')])}><MessageSquare size={15} className="mr-1.5" />Message</Button><Button variant="outline" size="sm" onClick={() => setSteps((current) => [...current, newStep('send_template')])}><Send size={15} className="mr-1.5" />Template</Button><Button variant="outline" size="sm" onClick={() => setSteps((current) => [...current, newStep('delay')])}><Clock3 size={15} className="mr-1.5" />Wait</Button><Button variant="outline" size="sm" onClick={() => setSteps((current) => [...current, newStep('condition')])}><GitBranch size={15} className="mr-1.5" />Condition</Button><Button variant="outline" size="sm" onClick={() => setSteps((current) => [...current, newStep('action')])}><UserRoundCheck size={15} className="mr-1.5" />Lead action</Button><Button variant="outline" size="sm" onClick={() => setSteps((current) => [...current, newStep('wait_for_reply')])}><MessageCircleQuestion size={15} className="mr-1.5" />Wait for reply</Button></div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent runs</h2><p className="mt-3 text-sm text-slate-500">This workflow has not been saved or run yet.</p></section>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </main>
        <Modal isOpen={Boolean(previewStep)} onClose={() => setPreviewStep(null)} title={previewStep ? `${stepMeta[previewStep.type]?.title || 'Workflow'} step` : 'Workflow step'}>
          {previewStep?.type === 'send_message' && <div className="rounded-lg bg-[#e5ddd5] p-5"><div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] p-3 text-sm leading-6 text-slate-900 shadow-sm whitespace-pre-wrap">{previewStep.data.message || '(Empty message)'}</div></div>}
          {previewStep?.type === 'send_template' && <div className="rounded-lg bg-[#e5ddd5] p-5"><div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-white p-3 text-sm text-slate-900 shadow-sm"><p className="font-semibold">{previewStep.data.template || 'No template selected'}</p><p className="mt-2 text-xs text-slate-500">Meta-approved template content will be sent with its configured variables.</p></div></div>}
          {previewStep?.type === 'delay' && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Wait for {previewStep.data.days || 0} days, {previewStep.data.hours || 0} hours and {previewStep.data.minutes || 0} minutes before the next action.</p>}
          {previewStep?.type === 'condition' && <dl className="space-y-2 text-sm text-slate-700"><div><dt className="text-xs font-semibold uppercase text-slate-400">Field</dt><dd>{previewStep.data.variablePath}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-400">Rule</dt><dd>{previewStep.data.operator}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-400">Value</dt><dd>{previewStep.data.value || '(not set)'}</dd></div></dl>}
          {previewStep?.type === 'action' && <dl className="space-y-2 text-sm text-slate-700"><div><dt className="text-xs font-semibold uppercase text-slate-400">Action</dt><dd>{previewStep.data.actionType}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-400">Target</dt><dd>{previewStep.data.actionValue || '(not set)'}</dd></div></dl>}
          {previewStep?.type === 'wait_for_reply' && <p className="rounded-lg bg-orange-50 p-4 text-sm text-orange-900">Wait for a customer reply for up to {previewStep.data.timeoutMinutes || 60} minutes.</p>}
        </Modal>
      </div>
    </div>
  );
}
