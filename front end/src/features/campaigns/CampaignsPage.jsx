import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Search, Send, Square, Trash2, Eye, ChevronRight, ChevronLeft,
    MessageSquare, Mail, Smartphone, Check, X, Clock, Zap, BarChart2,
    AlertCircle, RefreshCw, ArrowLeft, Users, Activity, CalendarClock, Upload,
    Image, Video, File as FileIcon, ChevronDown,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import ViewToggle from '../../components/ui/ViewToggle.jsx';
import {
    getCampaigns, getCampaignReport, retryCampaignRecipient, createCampaign, stopCampaign, deleteCampaign,
    getLabels, getLabelContacts, getTemplates, getEmailTemplates, uploadFlowMedia, createLabelFromCsv,
    createTemplate
} from './api.js';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import WorkspaceEmptyState from '../../components/ui/WorkspaceEmptyState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    scheduled: { label: 'Scheduled', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    running: { label: 'Running', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 border-green-200' },
    failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
    stopped: { label: 'Stopped', cls: 'bg-red-50 text-red-600 border-red-200' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// Extract variables {{1}}, {{2}} from template body text
function extractVarsFromTemplate(template) {
    if (!template) return [];
    const body = template.components?.find(c => c.type === 'BODY');
    if (!body?.text) return [];
    const matches = [...body.text.matchAll(/\{\{(\d+)\}\}/g)];
    return [...new Set(matches.map(m => m[1]))].sort((a, b) => Number(a) - Number(b));
}

function getBodyText(template) {
    if (!template) return '';
    const body = template.components?.find(c => c.type === 'BODY');
    return body?.text || '';
}

function getHeaderComponent(template) {
  if (!template) return null;
  return template.components?.find(c => c.type === 'HEADER');
}

function getHeaderMediaFormat(template) {
    const format = getHeaderComponent(template)?.format;
    return ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format) ? format : null;
}

function getFooterText(template) {
    if (!template) return '';
    const f = template.components?.find(c => c.type === 'FOOTER');
    return f?.text || '';
}

function getButtons(template) {
    if (!template) return [];
    const b = template.components?.find(c => c.type === 'BUTTONS');
    return b?.buttons || [];
}

// Available contact fields to map variables to
const BASE_CONTACT_FIELDS = [
    { value: 'display_name', label: 'Contact Name' },
    { value: 'external_id', label: 'Phone / External ID' },
    { value: 'email', label: 'Email Address' },
];

function CampaignPreview({ channel, template, mapping, smsMessage, headerUrl, headerFileName, contactFields = BASE_CONTACT_FIELDS }) {
    if (channel === 'whatsapp') return <WhatsAppPreview template={template} mapping={mapping} headerUrl={headerUrl} headerFileName={headerFileName} contactFields={contactFields} />;

    const isEmail = channel === 'email';
    const content = isEmail
        ? (template?.text_body || String(template?.html_body || '').replace(/<[^>]+>/g, ' '))
        : smsMessage;
    if (!content) return null;

    return (
        <div className="w-full rounded-xl border border-purple-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                {isEmail ? <Mail size={14} /> : <Smartphone size={14} />}
                {isEmail ? 'Email Preview' : 'SMS Preview'}
            </div>
            {isEmail && <p className="mb-2 text-sm font-semibold text-slate-900">{template?.subject || 'No subject'}</p>}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{content}</p>
        </div>
    );
}

function ChannelIcon({ channel, size = 11 }) {
    if (channel === 'email') return <Mail size={size} />;
    if (channel === 'sms') return <Smartphone size={size} />;
    return <MessageSquare size={size} />;
}

// ─── WhatsApp Preview ─────────────────────────────────────────────────────────
function WhatsAppPreview({ template, mapping, headerUrl, headerFileName, contactFields = BASE_CONTACT_FIELDS }) {
    if (!template) return null;

    const header = getHeaderComponent(template);
    const bodyText = getBodyText(template);
    const footer = getFooterText(template);
    const buttons = getButtons(template);

    // Replace {{n}} with mapped field labels
    const previewText = bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const field = mapping[n];
        const label = contactFields.find(f => f.value === field)?.label;
        return label ? `[${label}]` : `{{${n}}}`;
    });

    return (
        <div className="bg-[#e5ddd5] rounded-xl p-4 w-full">
            <p className="text-xs text-center text-slate-500 mb-3">WhatsApp Preview</p>
            <div className="max-w-xs mx-auto">
                {/* Chat bubble */}
                <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 space-y-2 relative">
                    {/* Header */}
                    {header && header.format === 'TEXT' && (
                        <p className="font-bold text-slate-900 text-sm">{header.text}</p>
                    )}
                    {header && header.format === 'IMAGE' && (
                        headerUrl
                            ? <img src={headerUrl} alt="Campaign header" className="h-28 w-full rounded-lg object-cover" />
                            : <div className="rounded-lg bg-slate-200 h-28 flex items-center justify-center"><span className="text-xs text-slate-400">Image Header</span></div>
                    )}
                    {header && ['VIDEO', 'DOCUMENT'].includes(header.format) && (
                        <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg bg-slate-200">
                            {header.format === 'VIDEO' ? <Video size={20} className="text-slate-400" /> : <FileIcon size={20} className="text-slate-400" />}
                            <span className="max-w-[90%] truncate text-xs text-slate-400">{headerFileName || `${header.format.toLowerCase()} header`}</span>
                        </div>
                    )}
                    {/* Body */}
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{previewText || '(no body text)'}</p>
                    {/* Footer */}
                    {footer && <p className="text-xs text-slate-400">{footer}</p>}
                    {/* Timestamp */}
                    <p className="text-right text-[10px] text-slate-400">12:00 PM ✓✓</p>
                </div>
                {/* Buttons */}
                {buttons.map((btn, i) => (
                    <div key={i} className="mt-1 bg-white rounded-lg shadow-sm px-3 py-2 text-center text-sm font-medium text-purple-700">
                        {btn.text}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function Steps({ current, steps }) {
    return (
        <div className="flex items-center gap-0 mb-6">
            {steps.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <React.Fragment key={i}>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${done ? 'bg-purple-600 border-purple-600 text-white' :
                                    active ? 'bg-white border-purple-600 text-purple-600' :
                                        'bg-white border-slate-300 text-slate-400'
                                }`}>
                                {done ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? 'text-purple-600' : done ? 'text-slate-600' : 'text-slate-400'}`}>
                                {label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors ${done ? 'bg-purple-600' : 'bg-slate-200'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── New Campaign Multi-Step Modal ────────────────────────────────────────────
const STEP_LABELS = ['Campaign Info', 'Template', 'Variables', 'Schedule'];

function NewCampaignPage({ onClose, onSuccess }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [name, setName] = useState('');
    const [channel, setChannel] = useState('whatsapp');
    const [labelId, setLabelId] = useState('');
    const [labels, setLabels] = useState([]);
    const [loadingLabels, setLoadingLabels] = useState(false);
    const [labelsError, setLabelsError] = useState('');
    const [contactFields, setContactFields] = useState(BASE_CONTACT_FIELDS);
    const [groupContactsPreview, setGroupContactsPreview] = useState([]);
    const [audienceMode, setAudienceMode] = useState('existing');
    const [csvGroupName, setCsvGroupName] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [csvBusy, setCsvBusy] = useState(false);

    const [templates, setTemplates] = useState([]);
    const [tmplSearch, setTmplSearch] = useState('');
    const [selectedTmpl, setSelectedTmpl] = useState(null);
    const [loadingTmpls, setLoadingTmpls] = useState(false);
    const [smsMessage, setSmsMessage] = useState('');

    const [mapping, setMapping] = useState({});
    const [headerUrl, setHeaderUrl] = useState('');
    const [headerFileName, setHeaderFileName] = useState('');
    const [headerUploading, setHeaderUploading] = useState(false);

    const [scheduleMode, setScheduleMode] = useState('now'); // 'now' | 'later'
    const [scheduledAt, setScheduledAt] = useState('');
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    useEffect(() => {
        setError('');
        setName(''); setChannel('whatsapp'); setLabelId(''); setSelectedTmpl(null);
        setMapping({}); setSmsMessage(''); setHeaderUrl(''); setHeaderFileName(''); setScheduleMode('now'); setScheduledAt('');
        setAudienceMode('existing'); setCsvGroupName(''); setCsvFile(null); setCsvBusy(false);

        setLoadingLabels(true);
        setLabelsError('');
        getLabels()
            .then(r => {
                const nextLabels = Array.isArray(r) ? r : (r.labels || r.data || []);
                setLabels(nextLabels);
                if (!nextLabels.length) setLabelsError('No labels found. Create a label and add contacts before launching a campaign.');
            })
            .catch(err => {
                console.error(err);
                setLabelsError('Unable to load labels. Please refresh and try again.');
            })
            .finally(() => setLoadingLabels(false));
    }, []);

    const fetchTemplatesData = useCallback(() => {
        if (channel === 'sms') return;
        setLoadingTmpls(true);
        const loader = channel === 'email' ? getEmailTemplates() : getTemplates();
        loader
            .then(r => setTemplates(channel === 'email' ? (r.items || []) : (r.data || [])))
            .catch(console.error)
            .finally(() => setLoadingTmpls(false));
    }, [channel]);

    useEffect(() => {
        fetchTemplatesData();
    }, [fetchTemplatesData]);

    const handleTemplateCreated = (newTmpl) => {
        setTemplates(current => [newTmpl, ...current]);
        setSelectedTmpl(newTmpl);
    };

    useEffect(() => {
        if (!selectedTmpl) return;
        const vars = extractVarsFromTemplate(selectedTmpl);
        const initial = {};
        vars.forEach(v => { initial[v] = BASE_CONTACT_FIELDS[0].value; });
        setMapping(initial);
        setHeaderUrl('');
        setHeaderFileName('');
    }, [selectedTmpl]);

    useEffect(() => {
        let cancelled = false;
        if (!labelId) {
            setContactFields(BASE_CONTACT_FIELDS);
            setGroupContactsPreview([]);
            return undefined;
        }
        getLabelContacts(labelId).then((response) => {
            if (cancelled) return;
            const contacts = response?.contacts || response?.data || response || [];
            setGroupContactsPreview(contacts.slice(0, 3));
            
            const foundKeys = new Set();
            (Array.isArray(contacts) ? contacts : []).slice(0, 25).forEach((contact) => {
                if (contact.name || contact.displayName) foundKeys.add('name');
                if (contact.phone) foundKeys.add('phone');
                if (contact.email) foundKeys.add('email');
                Object.keys(contact?.profile || {}).forEach((key) => foundKeys.add(key));
            });
            const dynamicFields = [...foundKeys].sort().map((key) => ({
                value: key,
                label: key === 'name' ? 'Contact Name' : key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
            }));
            
            setContactFields(dynamicFields.length > 0 ? dynamicFields : BASE_CONTACT_FIELDS);
            
            setMapping(current => {
                const updated = { ...current };
                let changed = false;
                Object.keys(updated).forEach(varNum => {
                    if (dynamicFields.length > 0 && !dynamicFields.find(f => f.value === updated[varNum])) {
                        updated[varNum] = dynamicFields[0].value;
                        changed = true;
                    }
                });
                return changed ? updated : current;
            });
            
        }).catch(() => { 
            if (!cancelled) {
                setContactFields(BASE_CONTACT_FIELDS);
                setGroupContactsPreview([]);
            }
        });
        return () => { cancelled = true; };
    }, [labelId]);

    const vars = extractVarsFromTemplate(selectedTmpl);
    const headerFormat = getHeaderMediaFormat(selectedTmpl);
    const filteredTmpls = templates.filter(t =>
        (channel === 'email' || t.status === 'APPROVED') &&
        String(t.name || '').toLowerCase().includes(tmplSearch.toLowerCase())
    );

    const canSubmit = () => {
        if (!name.trim() || !labelId) return false;
        if (channel === 'sms' && !smsMessage.trim()) return false;
        if (channel !== 'sms' && !selectedTmpl) return false;
        if (headerFormat && !headerUrl) return false;
        if (scheduleMode === 'later' && !scheduledAt) return false;
        return true;
    };

    const handleHeaderFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setHeaderUploading(true);
        setError('');
        try {
            const result = await uploadFlowMedia(file);
            const url = result?.url || result?.link || result?.data?.url || '';
            if (!url) throw new Error('Upload did not return a media URL');
            setHeaderUrl(url);
            setHeaderFileName(file.name);
        } catch (uploadError) {
            setError(uploadError?.message || 'Header media upload failed.');
        } finally {
            setHeaderUploading(false);
            event.target.value = '';
        }
    };

    const importCampaignCsv = async () => {
        if (!csvGroupName.trim() || !csvFile) {
            setError('Enter a group name and choose a CSV file first.');
            return;
        }
        setCsvBusy(true);
        setError('');
        try {
            const result = await createLabelFromCsv(csvGroupName.trim(), csvFile);
            const label = result?.label || result?.data?.label || result?.data || result;
            if (!label?.id) throw new Error(result?.error || result?.message || 'CSV import did not create a contact group.');
            setLabels((current) => [label, ...current.filter((item) => item.id !== label.id)]);
            setLabelId(label.id);
            setAudienceMode('existing');
            setCsvGroupName('');
            setCsvFile(null);
        } catch (importError) {
            setError(importError?.message || 'CSV import failed.');
        } finally { setCsvBusy(false); }
    };

    const buildHeaderComponents = () => {
        if (!headerFormat || !headerUrl) return [];
        const mediaType = headerFormat.toLowerCase();
        const media = { link: headerUrl };
        if (headerFormat === 'DOCUMENT' && headerFileName) media.filename = headerFileName;
        return [{ type: 'header', parameters: [{ type: mediaType, [mediaType]: media }] }];
    };

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            const res = await createCampaign({
                name,
                channel_type: channel,
                label_id: labelId,
                template_name: selectedTmpl?.name || null,
                template_language: selectedTmpl?.language || 'en_US',
                email_template_id: channel === 'email' ? selectedTmpl?.id : null,
                subject: channel === 'email' ? selectedTmpl?.subject : null,
                message_body: channel === 'sms' ? smsMessage : null,
                template_components: channel === 'whatsapp' ? buildHeaderComponents() : [],
                variable_mapping: mapping,
                scheduled_at: scheduleMode === 'later' ? scheduledAt : null,
                send_immediately: scheduleMode === 'now',
            });
            if (res.success) {
                onSuccess({
                    ...res.campaign,
                    label_id: labelId,
                    label_name: selectedLabel?.name || res.campaign?.label_name || '',
                    total_contacts: res.campaign?.total_contacts ?? selectedLabel?.assigned_count ?? 0,
                });
                onClose();
            }
            else setError(res.error || 'Failed to create campaign.');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const selectedLabel = labels.find(l => l.id === labelId);

    return (
        <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-[#f8f5fc] to-[#f1ebf9]">
            {/* Top Header */}
            <div className="border-b border-white/60 bg-white/40 backdrop-blur-md px-6 py-4 shrink-0 shadow-sm relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 w-10 rounded-2xl border border-white/60 bg-white/70 text-purple-700 shadow-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 flex items-center justify-center"
                        title="Back to campaigns"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-purple-500">Campaign Studio</p>
                        <h1 className="text-2xl font-black text-slate-900 drop-shadow-sm">Create Campaign</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={onClose} className="rounded-xl px-6 font-bold border-2 hover:bg-slate-50 transition-all h-10">Cancel</Button>
                    <Button
                        className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl px-6 font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 h-10"
                        disabled={!canSubmit() || saving}
                        onClick={handleSubmit}
                    >
                        {saving ? 'Launching...' : 'Launch Campaign'}
                        {!saving && <Send size={16} />}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left Side: Configuration Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-8 pb-12">
                        
                        {/* Error Message */}
                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3.5 text-sm font-bold text-red-700 flex items-center gap-3 shadow-sm">
                                <AlertCircle size={18} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Section 1: Campaign Info */}
                        <div className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-md p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">1</div> Campaign Basics</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full rounded-2xl border-2 border-white bg-white/50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-purple-400 focus:bg-white shadow-sm"
                                        placeholder="e.g. Diwali Mega Sale 2024"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">Communication Channel <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
                                            { id: 'email', icon: Mail, label: 'Email', disabled: true },
                                            { id: 'sms', icon: Smartphone, label: 'SMS', disabled: true },
                                        ].map(ch => (
                                            <button
                                                key={ch.id}
                                                type="button"
                                                disabled={ch.disabled}
                                                onClick={() => { setChannel(ch.id); setSelectedTmpl(null); setTemplates([]); setMapping({}); }}
                                                className={`group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-300 ${channel === ch.id
                                                        ? 'border-purple-500 bg-purple-50/50 shadow-sm'
                                                        : 'border-white bg-white/40 hover:border-purple-200'
                                                    }`}
                                            >
                                                <div className={`p-3 rounded-xl transition-colors ${channel === ch.id ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500 group-hover:bg-purple-50 group-hover:text-purple-600'}`}>
                                                    <ch.icon size={20} />
                                                </div>
                                                <span className={`text-sm font-bold ${channel === ch.id ? 'text-purple-700' : 'text-slate-600'}`}>{ch.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold text-slate-700">Target Audience <span className="text-red-500">*</span></label>
                                        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                                            <button type="button" onClick={() => setAudienceMode('existing')} className={`rounded-md px-2.5 py-1.5 ${audienceMode === 'existing' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Existing Group</button>
                                            <button type="button" onClick={() => setAudienceMode('csv')} className={`rounded-md px-2.5 py-1.5 ${audienceMode === 'csv' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Upload CSV</button>
                                        </div>
                                    </div>
                                    
                                    {audienceMode === 'existing' ? (
                                        <>
                                            <div className="relative">
                                                <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <select
                                                    className="w-full appearance-none rounded-2xl border-2 border-white bg-white/50 pl-11 pr-10 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-purple-400 focus:bg-white shadow-sm disabled:opacity-50"
                                                    value={labelId}
                                                    onChange={e => setLabelId(e.target.value)}
                                                    disabled={loadingLabels}
                                                >
                                                    <option value="">— Select a contact group —</option>
                                                    {labels.map(l => (
                                                        <option key={l.id} value={l.id}>{l.name} ({Number(l.assigned_count || 0).toLocaleString('en-IN')} contacts)</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                            {labelsError && <p className="mt-2 text-xs font-medium text-amber-600">{labelsError}</p>}
                                            
                                            {selectedLabel && groupContactsPreview.length > 0 && (
                                                <div className="mt-4 border border-slate-100 rounded-xl bg-slate-50/50 p-4">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audience Contacts Table</h4>
                                                    <div className="overflow-x-auto rounded-lg border border-slate-200/60 bg-white">
                                                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                                                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wide">
                                                                <tr>
                                                                    <th className="px-4 py-2">Name</th>
                                                                    <th className="px-4 py-2">Phone / ID</th>
                                                                    <th className="px-4 py-2">Email</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                                                                {groupContactsPreview.map((contact, idx) => (
                                                                    <tr key={idx} className="hover:bg-slate-50/30">
                                                                        <td className="px-4 py-2 truncate max-w-[150px]">{contact.name || contact.displayName || '—'}</td>
                                                                        <td className="px-4 py-2">{contact.phone || contact.external_id || '—'}</td>
                                                                        <td className="px-4 py-2 truncate max-w-[150px]">{contact.email || '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-5 mt-3 transition-colors hover:bg-purple-50/50">
                                            <div className="flex flex-col gap-4">
                                                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                                                    <div className="relative">
                                                        <input 
                                                            className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-purple-400 shadow-sm" 
                                                            placeholder="Enter new group name..." 
                                                            value={csvGroupName} 
                                                            onChange={(event) => setCsvGroupName(event.target.value)} 
                                                        />
                                                    </div>
                                                    <label className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-6 text-sm font-bold text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 hover:shadow">
                                                        <Upload size={16} />
                                                        {csvFile ? csvFile.name : 'Select CSV File'}
                                                        <input 
                                                            type="file" 
                                                            accept=".csv,text/csv" 
                                                            className="sr-only" 
                                                            onChange={(event) => setCsvFile(event.target.files?.[0] || null)} 
                                                        />
                                                    </label>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 border-t border-purple-100 pt-4">
                                                    <div className="flex items-start gap-2 text-purple-600/80">
                                                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                        <p className="text-[11px] leading-relaxed font-medium">
                                                            Include a <span className="font-bold text-purple-700">phone</span> or <span className="font-bold text-purple-700">mobile</span> column.<br/>Other columns become custom variables.
                                                        </p>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={importCampaignCsv} 
                                                        disabled={csvBusy} 
                                                        className="h-[40px] shrink-0 rounded-xl bg-purple-600 px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-purple-700 hover:shadow-lg focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 disabled:opacity-70 disabled:shadow-none flex items-center gap-2"
                                                    >
                                                        {csvBusy ? (
                                                            <>
                                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                                                                Importing...
                                                            </>
                                                        ) : 'Create group'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Template Selection & Variables */}
                        <div className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-md p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">2</div> Template & Content</h2>
                            
                            {channel === 'sms' ? (
                                <div className="mt-4">
                                    <textarea
                                        rows={5}
                                        maxLength={1000}
                                        value={smsMessage}
                                        onChange={(event) => setSmsMessage(event.target.value)}
                                        placeholder="Write your message. Use {{display_name}}, {{external_id}} or {{email}} for personalization."
                                        className="w-full resize-y rounded-2xl border-2 border-white bg-white/50 px-4 py-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-purple-400 focus:bg-white shadow-sm"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold text-slate-700">Select Template <span className="text-red-500">*</span></label>
                                            {channel === 'whatsapp' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsTemplateModalOpen(true)}
                                                    className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 transition-colors"
                                                >
                                                    <Plus size={14} /> Create WhatsApp Template
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search approved templates..."
                                                className="w-full rounded-2xl border-2 border-white bg-white/50 pl-11 pr-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-purple-400 focus:bg-white shadow-sm mb-3"
                                                value={tmplSearch}
                                                onChange={e => setTmplSearch(e.target.value)}
                                            />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {loadingTmpls ? (
                                                <div className="py-6"><GreetoLoader label="Loading templates..." /></div>
                                            ) : filteredTmpls.length === 0 ? (
                                                <div className="py-8 text-center text-sm text-slate-500">No templates found.</div>
                                            ) : (
                                                <div className="grid sm:grid-cols-2 gap-3">
                                                    {filteredTmpls.map(t => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => setSelectedTmpl(t)}
                                                            className={`text-left rounded-xl border-2 p-4 transition-all duration-300 relative group ${selectedTmpl?.id === t.id
                                                                    ? 'border-purple-500 bg-purple-50/80 shadow-sm'
                                                                    : 'border-white bg-white/60 hover:border-purple-200'
                                                                }`}
                                                        >
                                                            {selectedTmpl?.id === t.id && (
                                                                <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1"><Check size={10} className="text-white"/></div>
                                                            )}
                                                            <h3 className="font-bold text-slate-900 truncate pr-6 text-sm">{t.name}</h3>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                 <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider">{t.category}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Variables */}
                                    {selectedTmpl && vars.length > 0 && (
                                        <div className="pt-6 border-t border-slate-200/50">
                                            <h3 className="text-sm font-bold text-slate-800 mb-4">Variable Mapping</h3>
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                {vars.map(varNum => (
                                                    <div key={varNum} className="rounded-xl border border-white bg-white/60 p-4 shadow-sm">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="inline-flex h-6 items-center rounded-md bg-purple-100 px-2 font-mono text-xs font-bold text-purple-700">
                                                                {'{'}{'{'}{varNum}{'}'}{'}'}
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-500">maps to</span>
                                                        </div>
                                                        <div className="relative">
                                                            <select
                                                                className="w-full appearance-none rounded-lg border-2 border-slate-100 bg-white pl-3 pr-9 py-2 text-sm font-medium text-slate-700 outline-none focus:border-purple-400"
                                                                value={mapping[varNum] || ''}
                                                                onChange={e => setMapping(m => ({ ...m, [varNum]: e.target.value }))}
                                                            >
                                                                {contactFields.map(f => (
                                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Section 3: Scheduling */}
                        <div className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-md p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">3</div> Delivery Schedule</h2>
                            
                            <div className="grid sm:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setScheduleMode('now')}
                                    className={`relative flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${scheduleMode === 'now' 
                                        ? 'border-purple-500 bg-purple-50 shadow-sm' 
                                        : 'border-white bg-white/60 hover:border-purple-200'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${scheduleMode === 'now' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Zap size={20} />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-sm text-slate-800">Send Now</p>
                                    </div>
                                    {scheduleMode === 'now' && <Check size={18} className="text-purple-600"/>}
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setScheduleMode('later')}
                                    className={`relative flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${scheduleMode === 'later' 
                                        ? 'border-purple-500 bg-purple-50 shadow-sm' 
                                        : 'border-white bg-white/60 hover:border-purple-200'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${scheduleMode === 'later' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <CalendarClock size={20} />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-sm text-slate-800">Schedule</p>
                                    </div>
                                    {scheduleMode === 'later' && <Check size={18} className="text-purple-600"/>}
                                </button>
                            </div>

                            {scheduleMode === 'later' && (
                                <div className="mt-6">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Date & Time <span className="text-red-500">*</span></label>
                                    <input
                                        type="datetime-local"
                                        className="w-full sm:w-1/2 rounded-xl border-2 border-white bg-white/80 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-purple-400"
                                        value={scheduledAt}
                                        min={new Date().toISOString().slice(0, 16)}
                                        onChange={e => setScheduledAt(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Right Side: Live Preview Sidebar */}
                <div className="w-full md:w-[450px] bg-white/80 backdrop-blur-md border-l border-white/60 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)] z-20">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Eye size={18} className="text-purple-600"/> Live Preview</h3>
                        <p className="text-xs text-slate-500 mt-1">See how your campaign will look on their device.</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col items-center custom-scrollbar">
                        {/* Smartphone frame */}
                        <div className="relative border-slate-800 bg-slate-800 border-[12px] rounded-[2.5rem] h-[560px] w-[300px] shadow-2xl flex-shrink-0">
                            {/* Speaker notch */}
                            <div className="h-[22px] w-[2px] bg-slate-800 absolute -left-[14px] top-[72px] rounded-l-lg"></div>
                            <div className="h-[36px] w-[2px] bg-slate-800 absolute -left-[14px] top-[120px] rounded-l-lg"></div>
                            <div className="h-[36px] w-[2px] bg-slate-800 absolute -left-[14px] top-[170px] rounded-l-lg"></div>
                            <div className="h-[54px] w-[2px] bg-slate-800 absolute -right-[14px] top-[130px] rounded-r-lg"></div>
                            
                            <div className="rounded-[2rem] overflow-hidden w-full h-full bg-[#e5ddd5] flex flex-col relative">
                                {/* Top Dynamic Notch */}
                                <div className="absolute top-0 inset-x-0 flex justify-center z-30 pointer-events-none">
                                    <div className="bg-black h-3.5 w-24 rounded-b-xl"></div>
                                </div>

                                {/* Status Bar */}
                                <div className="h-6 bg-[#075e54] text-white text-[9px] px-5 flex justify-between items-center z-20 select-none font-semibold shrink-0">
                                    <span>9:41 AM</span>
                                    <div className="flex items-center gap-1">
                                        <span>5G</span>
                                        <div className="w-4.5 h-2 border border-white rounded-sm p-[1px] flex"><div className="w-full h-full bg-white rounded-2xs"></div></div>
                                    </div>
                                </div>

                                {/* Channel specific chat header */}
                                {channel === 'whatsapp' ? (
                                    <div className="bg-[#075e54] text-white px-3 py-2 flex items-center gap-2 shadow-sm shrink-0 z-20">
                                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs select-none">W</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs truncate">WhatsApp Campaign</p>
                                            <p className="text-[8px] opacity-75 leading-none">online</p>
                                        </div>
                                    </div>
                                ) : channel === 'sms' ? (
                                    <div className="bg-white border-b border-slate-200 text-slate-800 px-3 py-2.5 flex items-center gap-2 shrink-0 z-20 justify-center relative">
                                        <div className="flex flex-col items-center">
                                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600 select-none">S</div>
                                            <p className="font-bold text-[9px] text-slate-700 mt-1">SMS Service</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-purple-700 text-white px-3 py-2 flex items-center gap-2 shadow-sm shrink-0 z-20">
                                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs select-none">E</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs truncate">Email Service</p>
                                            <p className="text-[8px] opacity-75 leading-none">Active Mailbox</p>
                                        </div>
                                    </div>
                                )}

                                {/* Phone Screen Content Area */}
                                <div className={`flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col justify-start z-10 ${channel === 'sms' ? 'bg-slate-50' : channel === 'email' ? 'bg-white' : 'bg-[#e5ddd5]'}`}>
                                    {(!selectedTmpl && channel !== 'sms') ? (
                                        <div className="my-auto text-center text-slate-500/80 p-4">
                                            <MessageSquare className="mx-auto text-slate-400 mb-2" size={32} />
                                            <p className="text-xs font-semibold">Select a template to preview dynamic campaign</p>
                                        </div>
                                    ) : (
                                        <CampaignPreview channel={channel} template={selectedTmpl} mapping={mapping} smsMessage={smsMessage} headerUrl={headerUrl} headerFileName={headerFileName} contactFields={contactFields} />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Move Media Upload directly below preview frame */}
                        {selectedTmpl && headerFormat && channel === 'whatsapp' && (
                            <div className="w-full max-w-[300px] mt-5 p-4 rounded-2xl border border-purple-100 bg-white shadow-sm text-left">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Upload size={14} className="text-purple-600" />
                                    Upload {headerFormat.toLowerCase()} Header Media <span className="text-red-500">*</span>
                                </h3>
                                {headerUrl ? (
                                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                                        {headerFormat === 'IMAGE' ? (
                                            <img src={headerUrl} alt="Header" className="h-10 w-10 rounded-lg object-cover border border-emerald-100" />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 border border-emerald-200 shrink-0">
                                                {headerFormat === 'VIDEO' ? <Video size={16} className="text-emerald-600" /> : <FileIcon size={16} className="text-emerald-600" />}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-xs font-bold text-emerald-900">{headerFileName || 'Media Uploaded'}</p>
                                        </div>
                                        <button type="button" onClick={() => { setHeaderUrl(''); setHeaderFileName(''); }} className="p-1 text-emerald-700 hover:text-red-600 shrink-0">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/20 p-4 hover:bg-purple-50 transition-colors text-center">
                                        <Upload size={18} className="text-purple-600" />
                                        <span className="text-xs font-bold text-purple-700">{headerUploading ? 'Uploading...' : `Upload file`}</span>
                                        <input
                                            type="file"
                                            className="sr-only"
                                            disabled={headerUploading}
                                            accept={headerFormat === 'IMAGE' ? 'image/*' : headerFormat === 'VIDEO' ? 'video/*' : 'application/pdf,.doc,.docx,.xlsx,.pptx'}
                                            onChange={handleHeaderFileChange}
                                        />
                                    </label>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <CreateTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onCreated={handleTemplateCreated}
            />
        </div>
    );
}

// ─── Inline Create Template Modal ──────────────────────────────────────────
function CreateTemplateModal({ isOpen, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [headerType, setHeaderType] = useState('NONE');
    const [headerText, setHeaderText] = useState('');
    const [headerFile, setHeaderFile] = useState(null);
    const [headerFileName, setHeaderFileName] = useState('');
    const [headerUploading, setHeaderUploading] = useState(false);
    const [bodyText, setBodyText] = useState('');
    const [footerText, setFooterText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setHeaderUploading(true);
        setError('');
        try {
            const result = await uploadFlowMedia(file);
            const url = result?.url || result?.link || result?.data?.url || '';
            if (!url) throw new Error('Upload failed');
            setHeaderFile(url);
            setHeaderFileName(file.name);
        } catch (err) {
            setError('File upload failed.');
        } finally {
            setHeaderUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Enter a template name'); return; }
        if (!bodyText.trim()) { setError('Enter body text'); return; }

        const nameClean = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const components = [];

        if (headerType !== 'NONE') {
            const header = { type: 'HEADER', format: headerType };
            if (headerType === 'TEXT') {
                header.text = headerText;
                if (/\{\{1\}\}/.test(headerText)) {
                    header.example = { header_text: ['Example Text'] };
                }
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
                if (!headerFile) {
                    setError(`Please upload an example ${headerType.toLowerCase()} header file.`);
                    return;
                }
                header.example = { header_handle: [headerFile] }; 
            }
            components.push(header);
        }

        const bodyComp = { type: 'BODY', text: bodyText };
        const regex = /\{\{(\d+)\}\}/g;
        const matches = [...bodyText.matchAll(regex)];
        if (matches.length > 0) {
            const examples = matches.map((_, i) => `ExampleVal${i+1}`);
            bodyComp.example = { body_text: [examples] };
        }
        components.push(bodyComp);

        if (footerText.trim()) {
            components.push({ type: 'FOOTER', text: footerText.trim() });
        }

        setSaving(true);
        setError('');
        try {
            const payload = {
                name: nameClean,
                category,
                language: 'en_US',
                components
            };
            const result = await createTemplate(payload);
            if (result.error) {
                setError(result.error || 'Failed to create template.');
            } else {
                onCreated(result.template || result.data || { name: nameClean, category, language: 'en_US', status: 'APPROVED', components });
                onClose();
            }
        } catch (err) {
            setError(err.message || 'Error occurred while creating template.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-purple-50/50 shrink-0">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">Create WhatsApp Template</h3>
                        <p className="text-xs text-slate-500">Submit a new template directly for Meta WABA approval</p>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-left">
                    {error && (
                        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 flex items-center gap-2 animate-pulse">
                            <AlertCircle size={16} className="shrink-0" />
                            {error}
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Template Name</label>
                        <input
                            type="text"
                            placeholder="e.g. promotional_offer"
                            className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:bg-white transition-all"
                            value={name}
                            onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                        />
                        <p className="text-[10px] text-slate-400">Lowercases, numbers, and underscores only.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Category</label>
                            <select
                                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:bg-white"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            >
                                <option value="MARKETING">Marketing</option>
                                <option value="UTILITY">Utility</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Header Type</label>
                            <select
                                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:bg-white"
                                value={headerType}
                                onChange={e => setHeaderType(e.target.value)}
                            >
                                <option value="NONE">None</option>
                                <option value="TEXT">Text</option>
                                <option value="IMAGE">Image</option>
                                <option value="VIDEO">Video</option>
                                <option value="DOCUMENT">Document</option>
                            </select>
                        </div>
                    </div>
                    {headerType === 'TEXT' && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Header Text</label>
                            <input
                                type="text"
                                placeholder="e.g. Welcome {{1}}!"
                                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:bg-white transition-all"
                                value={headerText}
                                onChange={e => setHeaderText(e.target.value)}
                            />
                        </div>
                    )}
                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Header Example File</label>
                            {headerFile ? (
                                <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                                    <span className="text-xs font-bold text-emerald-800 truncate max-w-[80%]">{headerFileName}</span>
                                    <button onClick={() => { setHeaderFile(null); setHeaderFileName(''); }} className="text-emerald-700 hover:text-red-500"><X size={16}/></button>
                                </div>
                            ) : (
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-4 text-xs font-bold text-purple-700 hover:bg-purple-50">
                                    <Upload size={16} />
                                    <span>{headerUploading ? 'Uploading...' : `Upload ${headerType.toLowerCase()} file`}</span>
                                    <input type="file" className="sr-only" onChange={handleFileChange} accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : 'application/pdf,.doc,.docx,.xlsx'} disabled={headerUploading}/>
                                </label>
                            )}
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Body Text</label>
                        <textarea
                            rows={4}
                            placeholder="Hello {{1}}, your order {{2}} has been shipped!"
                            className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:bg-white transition-all resize-none"
                            value={bodyText}
                            onChange={e => setBodyText(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400">Use double braces for variables, e.g. {'{{1}}'}, {'{{2}}'}.</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Footer Text (Optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. Reply STOP to opt out"
                            className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:bg-white transition-all"
                            value={footerText}
                            onChange={e => setFooterText(e.target.value)}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || headerUploading} className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold px-5">
                        {saving ? 'Submitting...' : 'Submit Template'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// --- Main Campaigns Page -------------------------------------------------------
function CampaignReportModal({ campaign, onClose }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadReport = useCallback(() => {
        setLoading(true);
        setError('');
        return getCampaignReport(campaign.id)
            .then((result) => {
                if (!result?.success) throw new Error(result?.message || result?.error || 'Unable to load campaign report');
                setReport(result);
            })
            .catch((err) => setError(err.message || 'Unable to load campaign report'))
            .finally(() => setLoading(false));
    }, [campaign.id]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const retryRecipient = async (item) => {
        try {
            await retryCampaignRecipient(campaign.id, item.id);
            await loadReport();
        } catch (err) {
            setError(err.message || 'Unable to retry recipient');
        }
    };

    const summary = report?.summary || {};
    const metrics = [
        ['Audience', campaign.total_contacts || 0],
        ['Attempted', summary.attempted || 0],
        ['Sent', summary.sent || 0],
        ['Delivered', summary.delivered || 0],
        ['Read', summary.read || 0],
        ['Failed', summary.failed || 0],
    ];

    return (
        <Modal isOpen onClose={onClose} title={`${campaign.name} report`} className="max-w-3xl">
            {loading ? <GreetoLoader label="Loading campaign report..." sublabel="Reading delivery activity" /> : error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>
            ) : <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xl font-black text-slate-950">{value}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    </div>)}
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-900">Latest recipient activity</h4>
                    <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200">
                        {!report.recent?.length ? <p className="p-5 text-sm text-slate-500">No delivery attempts have been recorded yet.</p> : report.recent.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">{item.display_name || item.email || item.recipient || 'Contact'}</p>
                                    <p className="truncate text-xs text-slate-500">{item.recipient || 'No recipient'}{item.error_message ? ` - ${item.error_message}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={item.status === 'sent' || item.status === 'delivered' || item.status === 'read' ? 'completed' : item.status} />
                                    {item.status === 'failed' && <Button variant="outline" size="sm" onClick={() => retryRecipient(item)}>Retry</Button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>}
        </Modal>
    );
}

export default function CampaignsPage({ onNavigate }) {
    const [campaigns, setCampaigns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('table');
    const [isCreating, setIsCreating] = useState(false);
    const [reportCampaign, setReportCampaign] = useState(null);

    const fetchCampaigns = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getCampaigns();
            if (res.success) setCampaigns(res.campaigns);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    const handleStop = async (id) => {
        if (!(await confirmAction({
            title: 'Stop campaign?',
            message: 'This campaign will stop sending new messages.',
            confirmLabel: 'Stop campaign',
            tone: 'toggle',
        }))) return;
        await stopCampaign(id);
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'stopped' } : c));
    };

    const handleDelete = async (id) => {
        if (!(await confirmAction({
            title: 'Delete campaign?',
            message: 'Delete this campaign permanently?',
            confirmLabel: 'Delete campaign',
            tone: 'danger',
        }))) return;
        await deleteCampaign(id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
    };

    const handleSuccess = (campaign) => {
        setCampaigns(prev => [campaign, ...prev]);
    };

    const filtered = campaigns.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.label_name || '').toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total: campaigns.length,
        running: campaigns.filter(c => c.status === 'running').length,
        scheduled: campaigns.filter(c => c.status === 'scheduled').length,
        contacts: campaigns.reduce((sum, c) => sum + (Number(c.total_contacts) || 0), 0),
    };

    if (isCreating) {
        return (
            <NewCampaignPage
                onClose={() => setIsCreating(false)}
                onSuccess={(campaign) => {
                    handleSuccess(campaign);
                    setIsCreating(false);
                }}
            />
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f7f3fb]">
            {reportCampaign && <CampaignReportModal campaign={reportCampaign} onClose={() => setReportCampaign(null)} />}

            {/* Header */}
            <div className="border-b border-purple-100 bg-white/95 px-6 py-5 shrink-0">
                <div className="flex items-center justify-between gap-4">
                <div>
                        {/* <p className="text-xs font-bold uppercase tracking-[0.24em] text-purple-500">Campaign Center</p> */}
                    <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Campaigns</h1>
                    <p className="text-sm font-semibold text-slate-500">Launch WhatsApp, email, and SMS campaigns for your contact groups.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="flex items-center gap-2" onClick={fetchCampaigns}>
                        <RefreshCw size={15} />
                    </Button>
                    <Button
                            className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white"
                            onClick={() => setIsCreating(true)}
                    >
                        <Plus size={16} />
                        New Campaign
                    </Button>
                </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-full mx-auto space-y-5">

                    <div className="grid gap-4 md:grid-cols-4">
                        {[
                            { label: 'Total Campaigns', value: stats.total, icon: BarChart2, tone: 'bg-purple-100 text-purple-700' },
                            { label: 'Running', value: stats.running, icon: Activity, tone: 'bg-amber-100 text-amber-700' },
                            { label: 'Scheduled', value: stats.scheduled, icon: CalendarClock, tone: 'bg-indigo-100 text-indigo-700' },
                            { label: 'Audience Reach', value: stats.contacts.toLocaleString('en-IN'), icon: Users, tone: 'bg-emerald-100 text-emerald-700' },
                        ].map(item => (
                            <div key={item.label} className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm">
                                <div className={`h-11 w-11 rounded-2xl ${item.tone} flex items-center justify-center`}>
                                    <item.icon size={20} />
                                </div>
                                <p className="mt-4 text-2xl font-bold text-slate-950">{item.value}</p>
                                <p className="text-sm font-bold text-slate-500">{item.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="rounded-3xl border border-purple-100 bg-white p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center w-full md:max-w-md bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 gap-2">
                        <Search size={15} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search campaigns..."
                            className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-slate-500">
                                Showing <span className="font-semibold text-slate-900">{filtered.length}</span> of <span className="font-semibold text-slate-900">{campaigns.length}</span> campaigns
                            </p>
                            <ViewToggle value={viewMode} onChange={setViewMode} className="shrink-0" />
                        </div>
                    </div>

                    {viewMode === 'board' && (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {isLoading ? (
                                <div className="col-span-full rounded-3xl border border-purple-100 bg-white p-10 shadow-sm">
                                    <GreetoLoader label="Loading campaigns..." sublabel="Fetching campaign performance" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="col-span-full rounded-3xl border border-dashed border-violet-200 bg-white">
                                    <WorkspaceEmptyState title="Plan your first campaign" description="Create a draft now. Sending stays unavailable until you add an audience and connect a channel." primaryLabel="Create campaign" onPrimary={() => setIsCreating(true)} secondaryLabel="Open integrations" onSecondary={() => onNavigate?.('integrations')} />
                                </div>
                            ) : filtered.map(c => (
                                <div key={c.id} className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-lg font-bold text-slate-950">{c.name}</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-400">{c.label_name || 'No group selected'}</p>
                                        </div>
                                        <StatusBadge status={c.status} />
                                    </div>
                                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                        {[
                                            ['Contacts', c.total_contacts],
                                            ['Sent', c.sent_count],
                                            ['Delivered', c.delivered_count],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-2xl bg-slate-50 px-3 py-2">
                                                <p className="text-base font-bold text-slate-950">{value || 0}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-bold capitalize text-green-700">
                                            <ChannelIcon channel={c.channel_type} />
                                            {c.channel_type}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-purple-50 hover:text-purple-700" onClick={() => setReportCampaign(c)} title="View campaign report">
                                                <Eye size={14} />
                                            </Button>
                                            {c.status === 'running' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleStop(c.id)}>
                                                    <Square size={14} />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-500" onClick={() => handleDelete(c.id)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table */}
                    {viewMode === 'table' && <div className="bg-white border border-purple-100 rounded-3xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium whitespace-nowrap text-xs uppercase tracking-wide">
                                    <tr>
                                        <th className="px-5 py-4">Campaign Name</th>
                                        <th className="px-5 py-4">Label</th>
                                        <th className="px-5 py-4">Channel</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4 text-center">Contacts</th>
                                        <th className="px-5 py-4 text-center">Sent</th>
                                        <th className="px-5 py-4 text-center">Delivered</th>
                                        <th className="px-5 py-4">Scheduled</th>
                                        <th className="px-5 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                                <GreetoLoader label="Loading campaigns..." sublabel="Fetching campaign performance" />
                                            </td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="p-0"><WorkspaceEmptyState title="No campaigns yet" description="Create a draft and connect a channel before sending it to your audience." primaryLabel="Create campaign" onPrimary={() => setIsCreating(true)} secondaryLabel="Open integrations" onSecondary={() => onNavigate?.('integrations')} /></td>
                                        </tr>
                                    ) : filtered.map(c => (
                                        <tr key={c.id} className="hover:bg-purple-50/50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{c.name}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600">{c.label_name || '—'}</td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100 capitalize">
                                                    <ChannelIcon channel={c.channel_type} />
                                                    {c.channel_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                                            <td className="px-5 py-4 text-center font-medium text-slate-700">{c.total_contacts}</td>
                                            <td className="px-5 py-4 text-center font-medium text-slate-700">{c.sent_count}</td>
                                            <td className="px-5 py-4 text-center font-medium text-slate-700">{c.delivered_count}</td>
                                            <td className="px-5 py-4 text-slate-500 text-xs">
                                                {c.scheduled_at
                                                    ? new Date(c.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                                                    : c.status === 'running' ? 'In progress'
                                                        : c.started_at ? 'Immediate'
                                                            : '—'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-slate-500 hover:text-purple-700 hover:bg-purple-50"
                                                        onClick={() => setReportCampaign(c)}
                                                        title="View campaign report"
                                                    >
                                                        <Eye size={14} />
                                                    </Button>
                                                    {c.status === 'running' && (
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => handleStop(c.id)}
                                                            title="Stop Campaign"
                                                        >
                                                            <Square size={14} />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        onClick={() => handleDelete(c.id)}
                                                        title="Delete Campaign"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>}

                </div>
            </div>

        </div>
    );
}

