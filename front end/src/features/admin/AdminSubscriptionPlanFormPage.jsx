import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Crown, Loader2, Plus, Save, Sparkles, X } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { createAdminSubscriptionPlan, updateAdminSubscriptionPlan } from './api.js';

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
const TRIAL_OPTIONS = [
  { value: 0, label: 'No free trial' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];
const CHANNEL_OPTIONS = ['WhatsApp', 'Instagram', 'Telegram', 'Email', 'SMS', 'Voice'];
const FEATURE_SUGGESTIONS = [
  'Unified inbox',
  'Contact management',
  'WhatsApp templates',
  'Campaign automation',
  'Workflow builder',
  'AI agent',
  'Team assignment',
  'Advanced reports',
  'API access',
  'Priority support',
];
const ADDON_OPTIONS = [
  { value: 'extra_agents', label: 'Extra agents' },
  { value: 'media_storage', label: 'Media storage' },
  { value: 'priority_support', label: 'Priority support' },
  { value: 'advanced_analytics', label: 'Advanced analytics' },
];

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  currency: 'INR',
  monthlyPrice: '',
  quarterlyPrice: '',
  yearlyPrice: '',
  trialDays: 0,
  contactLimit: '',
  conversationLimit: '',
  workflowLimit: '',
  templateLimit: '',
  teamMemberLimit: '',
  campaignLimit: '',
  channelLimit: '',
  storageLimitBytes: '',
  features: '',
  channels: '',
  addons: '',
  sortOrder: 100,
  isActive: true,
};

function toForm(plan) {
  if (!plan) return emptyForm;
  return {
    name: plan.name || '',
    slug: plan.slug || '',
    description: plan.description || '',
    currency: plan.currency || 'INR',
    monthlyPrice: plan.price?.monthly ?? '',
    quarterlyPrice: plan.price?.quarterly ?? '',
    yearlyPrice: plan.price?.yearly ?? '',
    trialDays: plan.trialDays ?? 0,
    contactLimit: plan.limits?.contacts ?? '',
    conversationLimit: plan.limits?.conversations ?? '',
    workflowLimit: plan.limits?.workflows ?? '',
    templateLimit: plan.limits?.templates ?? '',
    teamMemberLimit: plan.limits?.teamMembers ?? '',
    campaignLimit: plan.limits?.campaigns ?? '',
    channelLimit: plan.limits?.channels ?? '',
    storageLimitBytes: plan.limits?.storageBytes ?? '',
    features: (plan.features || []).join('\n'),
    channels: (plan.channels || []).join(', '),
    addons: (plan.addons || []).join(', '),
    sortOrder: plan.sortOrder ?? 100,
    isActive: plan.isActive !== false,
  };
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function money(value, currency) {
  if (value === '' || value == null) return null;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function Section({ title, description, children }) {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', hint, min, step }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <input
        type={type}
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-2xl border border-purple-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
      />
      {hint && <span className="mt-1.5 block text-xs font-medium text-slate-400">{hint}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-purple-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {hint && <span className="mt-1.5 block text-xs font-medium text-slate-400">{hint}</span>}
    </label>
  );
}

function ChoiceGrid({ label, options, selected, onToggle, hint }) {
  return (
    <div>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const display = typeof option === 'string' ? option : option.label;
          const active = selected.includes(value);
          return (
            <button key={value} type="button" aria-pressed={active} onClick={() => onToggle(value)} className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm font-bold transition ${active ? 'border-purple-300 bg-purple-50 text-purple-800' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50/40'}`}>
              <span>{display}</span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 text-transparent'}`}><Check size={13} strokeWidth={3} /></span>
            </button>
          );
        })}
      </div>
      {hint && <span className="mt-2 block text-xs font-medium text-slate-400">{hint}</span>}
    </div>
  );
}

function FeatureEditor({ value, onChange }) {
  const [draft, setDraft] = useState('');
  const features = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const normalized = new Set(features.map((item) => item.toLowerCase()));

  const saveFeatures = (next) => onChange(next.join('\n'));
  const addFeature = (candidate) => {
    const feature = String(candidate || '').trim();
    if (!feature || normalized.has(feature.toLowerCase())) return;
    saveFeatures([...features, feature]);
    setDraft('');
  };
  const removeFeature = (feature) => saveFeatures(features.filter((item) => item !== feature));

  return (
    <div>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Included features</span>
      <div className="mt-2 rounded-2xl border border-purple-100 bg-white p-3 transition focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100">
        <div className="flex min-h-10 flex-wrap gap-2">
          {features.length ? features.map((feature) => (
            <span key={feature} className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800">
              {feature}
              <button type="button" onClick={() => removeFeature(feature)} className="text-purple-400 transition hover:text-purple-800" aria-label={`Remove ${feature}`}><X size={13} /></button>
            </span>
          )) : <span className="px-1 py-1.5 text-sm font-medium text-slate-400">No features added yet.</span>}
        </div>
        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addFeature(draft);
              }
            }}
            placeholder="Type a feature and press Enter"
            className="h-10 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none"
          />
          <button type="button" onClick={() => addFeature(draft)} disabled={!draft.trim()} className="flex h-10 items-center gap-1.5 rounded-xl bg-purple-600 px-3 text-xs font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} /> Add</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {FEATURE_SUGGESTIONS.filter((feature) => !normalized.has(feature.toLowerCase())).map((feature) => (
          <button key={feature} type="button" onClick={() => addFeature(feature)} className="rounded-full border border-purple-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800">+ {feature}</button>
        ))}
      </div>
      <span className="mt-2 block text-xs font-medium text-slate-400">Select a suggestion or add a custom benefit. Duplicate features are ignored.</span>
    </div>
  );
}

function CurrencyField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <select
        value={CURRENCY_OPTIONS.includes(value) ? value : 'INR'}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-2xl border border-purple-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
      >
        {CURRENCY_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3, placeholder = '', hint }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-none rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
      />
      {hint && <span className="mt-1.5 block text-xs font-medium text-slate-400">{hint}</span>}
    </label>
  );
}

export default function AdminSubscriptionPlanFormPage({ plan, onBack, onSaved }) {
  const isEditing = Boolean(plan);
  const [form, setForm] = useState(() => toForm(plan));
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'name' && !slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  const previewFeatures = useMemo(
    () => form.features.split(/\r?\n/).map((f) => f.trim()).filter(Boolean).slice(0, 6),
    [form.features]
  );
  const selectedChannels = useMemo(() => form.channels.split(',').map((item) => item.trim()).filter(Boolean), [form.channels]);
  const selectedAddons = useMemo(() => form.addons.split(',').map((item) => item.trim()).filter(Boolean), [form.addons]);

  const toggleListValue = (field, value) => {
    const current = field === 'channels' ? selectedChannels : selectedAddons;
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateField(field, next.join(', '));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setMessage('Plan name is required.');
      return;
    }
    if (!form.slug.trim()) {
      setMessage('Plan slug is required.');
      return;
    }
    const numericFields = [
      ['Monthly price', form.monthlyPrice], ['Quarterly price', form.quarterlyPrice], ['Yearly price', form.yearlyPrice],
      ['Contact limit', form.contactLimit], ['Conversation limit', form.conversationLimit], ['Workflow limit', form.workflowLimit],
      ['Template limit', form.templateLimit], ['Team member limit', form.teamMemberLimit], ['Campaign limit', form.campaignLimit],
      ['Channel limit', form.channelLimit], ['Storage limit', form.storageLimitBytes],
    ];
    const invalidNumber = numericFields.find(([, value]) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0));
    if (invalidNumber) {
      setMessage(`${invalidNumber[0]} must be zero or greater.`);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const action = isEditing ? updateAdminSubscriptionPlan(plan.id, form) : createAdminSubscriptionPlan(form);
      const result = await action;
      if (!result.success) throw new Error(result.message || 'Unable to save plan.');
      onSaved(result.plan);
    } catch (error) {
      setMessage(error.message || 'Unable to save plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f4f1fb] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-purple-100 bg-white text-slate-500 shadow-sm transition hover:bg-purple-50 hover:text-purple-700"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-500">{isEditing ? 'Edit Plan' : 'Create Plan'}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{isEditing ? plan.name : 'New subscription plan'}</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                {isEditing ? 'Update pricing, limits and feature access for this plan.' : 'Define a new customer-facing plan for the subscription catalog.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {isEditing ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-[24px] border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <div className="space-y-6">
            <Section title="Plan details" description="How this plan is identified and described to customers.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plan name" value={form.name} onChange={(v) => updateField('name', v)} placeholder="Growth" />
                <Field
                  label="Slug"
                  value={form.slug}
                  onChange={(v) => { setSlugTouched(true); updateField('slug', slugify(v)); }}
                  placeholder="growth"
                  hint="Used internally and in URLs — auto-generated from the name unless edited."
                />
              </div>
              <TextArea label="Description" value={form.description} onChange={(v) => updateField('description', v)} rows={3} placeholder="Who this plan is for and what it unlocks." />
              <label className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-purple-50/50 p-4 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateField('isActive', event.target.checked)}
                  className="h-4 w-4 accent-purple-600"
                />
                Active and visible on the customer subscription page
              </label>
            </Section>

            <Section title="Pricing" description="Prices are billed per cycle in the selected currency.">
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Monthly" type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(v) => updateField('monthlyPrice', v)} placeholder="999" />
                <Field label="Quarterly" type="number" min="0" step="0.01" value={form.quarterlyPrice} onChange={(v) => updateField('quarterlyPrice', v)} placeholder="2697" />
                <Field label="Yearly" type="number" min="0" step="0.01" value={form.yearlyPrice} onChange={(v) => updateField('yearlyPrice', v)} placeholder="9588" />
                <CurrencyField label="Currency" value={form.currency} onChange={(v) => updateField('currency', v)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Free trial" value={form.trialDays} onChange={(v) => updateField('trialDays', Number(v))} options={TRIAL_OPTIONS} hint="Choose how long customers can evaluate this plan." />
                <Field label="Sort order" type="number" min="0" step="1" value={form.sortOrder} onChange={(v) => updateField('sortOrder', v)} hint="Lower numbers appear first in the catalog." />
              </div>
            </Section>

            <Section title="Usage limits" description="Leave a field blank for unlimited usage on that dimension.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Contacts" type="number" min="0" step="1" value={form.contactLimit} onChange={(v) => updateField('contactLimit', v)} placeholder="Unlimited" />
                <Field label="Conversations" type="number" min="0" step="1" value={form.conversationLimit} onChange={(v) => updateField('conversationLimit', v)} placeholder="Unlimited" />
                <Field label="Workflows" type="number" min="0" step="1" value={form.workflowLimit} onChange={(v) => updateField('workflowLimit', v)} placeholder="Unlimited" />
                <Field label="Templates" type="number" min="0" step="1" value={form.templateLimit} onChange={(v) => updateField('templateLimit', v)} placeholder="Unlimited" />
                <Field label="Team members" type="number" min="0" step="1" value={form.teamMemberLimit} onChange={(v) => updateField('teamMemberLimit', v)} placeholder="Unlimited" />
                <Field label="Campaigns" type="number" min="0" step="1" value={form.campaignLimit} onChange={(v) => updateField('campaignLimit', v)} placeholder="Unlimited" />
                <Field label="Connected channels" type="number" min="0" step="1" value={form.channelLimit} onChange={(v) => updateField('channelLimit', v)} placeholder="Unlimited" />
                <Field label="Storage bytes" type="number" min="0" step="1" value={form.storageLimitBytes} onChange={(v) => updateField('storageLimitBytes', v)} placeholder="262144000" hint="Use bytes: 262144000 = 250 MB." />
              </div>
            </Section>

            <Section title="Plan access" description="Organize the channels, features and optional capabilities included in this plan.">
              <ChoiceGrid label="Included channels" options={CHANNEL_OPTIONS} selected={selectedChannels} onToggle={(value) => toggleListValue('channels', value)} hint="Customers can use only the selected communication channels." />
              <FeatureEditor value={form.features} onChange={(value) => updateField('features', value)} />
              <ChoiceGrid label="Available add-ons" options={ADDON_OPTIONS} selected={selectedAddons} onToggle={(value) => toggleListValue('addons', value)} hint="These add-ons can be attached to this plan by the billing catalog." />
            </Section>

            <div className="flex justify-end gap-2 pb-2">
              <Button variant="outline" onClick={onBack}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {isEditing ? 'Save Changes' : 'Create Plan'}
              </Button>
            </div>
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-purple-500">Live preview</p>
            <Card className="overflow-hidden p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-fuchsia-50 text-purple-700">
                <Crown size={20} />
              </div>
              <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">{form.name || 'Plan name'}</h3>
              <p className="mt-1.5 min-h-[36px] text-sm font-medium leading-5 text-slate-500">{form.description || 'A workspace plan for your team operations.'}</p>
              <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                <span className="text-2xl font-black tracking-tight text-slate-950">{money(form.monthlyPrice, form.currency) || 'Custom'}</span>
                <span className="ml-1 text-xs font-bold text-slate-400">/ monthly</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Contacts</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{form.contactLimit || 'Unlimited'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Agents</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{form.teamMemberLimit || 'Unlimited'}</p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {previewFeatures.length ? previewFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={14} />
                    <span>{feature}</span>
                  </div>
                )) : (
                  <div className="flex items-start gap-2 text-xs font-medium leading-5 text-slate-400">
                    <Sparkles className="mt-0.5 shrink-0" size={14} />
                    <span>Add features to preview the checklist customers will see.</span>
                  </div>
                )}
              </div>
              {!form.isActive && (
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  Inactive — hidden from customers
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
