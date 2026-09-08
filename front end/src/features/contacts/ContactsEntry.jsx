import React, { useState, useEffect, useMemo } from 'react';
import { Download, Upload, Plus, Search, MoreHorizontal, User, MessageCircle, Instagram, Database, X, Trash2, RefreshCcw, Filter, ChevronLeft, ChevronRight, ChevronDown, ArrowRight, ExternalLink, CloudUpload, Check, AlertCircle, Loader2, Sparkles, LocateFixed } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/use-toast.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import ViewToggle from '../../components/ui/ViewToggle.jsx';
import { getContacts, getContactChannels, addContact, deleteContact, syncXoloxContacts, getXoloxSyncStatus, putContact, importContactsBulk, getGenericIntegrationSettings } from './api.js';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import WorkspaceEmptyState from '../../components/ui/WorkspaceEmptyState.jsx';

const LEAD_STAGES = [
    'N2 Fresh Leads',
    'N2 Minus',
    'N2 Plus',
    'N3 Interested',
    'N3 Plus',
    'N3 Minus',
    'Lost',
    'Converted'
];

const LEAD_STATUSES = [
    'new',
    'renewed',
    'assigned',
    'contacted',
    'interested',
    'not_interested',
    'counseling',
    'won',
    'lost'
];

const COURSE_OPTIONS = ['CPA', 'CMA USA', 'ACCA', 'CFA', 'CIA', 'EA'];
const PROFESSION_OPTIONS = ['Student', 'Working Professional'];

const IMPORT_STEPS = ['Upload CSV', 'Map Columns', 'Review'];
const IMPORT_FIELDS = [
    { label: '(Skip this column)', value: '' },
    { label: 'First Name', value: 'firstName' },
    { label: 'Last Name', value: 'lastName' },
    { label: 'Display Name', value: 'displayName' },
    { label: 'Email', value: 'email' },
    { label: 'Phone Number', value: 'phone' },
    { label: 'Company', value: 'company' },
    { label: 'Job Title', value: 'jobTitle' },
    { label: 'Course', value: 'course' },
    { label: 'Profession', value: 'profession' },
    { label: 'City / Location', value: 'city' },
    { label: 'Lead Stage', value: 'leadStage' },
    { label: 'Lead Status', value: 'leadStatus' },
    { label: 'Assigned To', value: 'assignedTo' },
    { label: 'Tags', value: 'tags' },
];

function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(fileName, rows) {
    const headers = ['status', 'rowNumber', 'reason', 'displayName', 'firstName', 'lastName', 'email', 'phone', 'company', 'jobTitle', 'course', 'profession', 'city', 'leadStage', 'leadStatus', 'assignedTo', 'tags', 'contactId'];
    const lines = [
        headers.join(','),
        ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function reportRows(report, kind) {
    if (kind === 'imported') {
        return (report.imported || []).map(row => ({
            status: 'imported',
            rowNumber: row.rowNumber,
            reason: '',
            displayName: row.contact?.display_name || row.input?.displayName,
            firstName: row.input?.firstName,
            lastName: row.input?.lastName,
            email: row.contact?.email || row.input?.email,
            phone: row.contact?.external_id || row.input?.phone,
            company: row.input?.company,
            jobTitle: row.input?.jobTitle,
            course: row.contact?.course || row.input?.course,
            city: row.contact?.profile?.city || row.input?.city,
            leadStage: row.contact?.lead_stage || row.input?.leadStage,
            leadStatus: row.contact?.lead_status || row.input?.leadStatus,
            assignedTo: row.contact?.assigned_to || row.input?.assignedTo,
            tags: (row.input?.tags || []).join('; '),
            contactId: row.contact?.id,
        }));
    }
    return (report[kind] || []).map(row => ({
        status: kind === 'duplicates' ? 'duplicate' : 'failed',
        rowNumber: row.rowNumber,
        reason: row.reason,
        displayName: row.input?.displayName,
        firstName: row.input?.firstName,
        lastName: row.input?.lastName,
        email: row.input?.email,
        phone: row.input?.phone,
        company: row.input?.company,
        jobTitle: row.input?.jobTitle,
        course: row.input?.course,
        city: row.input?.city,
        leadStage: row.input?.leadStage,
        leadStatus: row.input?.leadStatus,
        assignedTo: row.input?.assignedTo,
        tags: (row.input?.tags || []).join('; '),
        contactId: '',
    }));
}

function autoMap(header) {
    const h = String(header || '').toLowerCase().replace(/[^a-z]/g, '');
    if (['firstname', 'first'].includes(h)) return 'firstName';
    if (['lastname', 'last', 'surname'].includes(h)) return 'lastName';
    if (['fullname', 'name', 'displayname', 'leadname'].includes(h)) return 'displayName';
    if (['email', 'emailaddress', 'mail'].includes(h)) return 'email';
    if (['phone', 'phonenumber', 'mobile', 'mobilenumber', 'whatsapp', 'telephone', 'tel'].includes(h)) return 'phone';
    if (['company', 'organization', 'org'].includes(h)) return 'company';
    if (['jobtitle', 'title', 'position', 'role'].includes(h)) return 'jobTitle';
    if (['course', 'coursename', 'program'].includes(h)) return 'course';
    if (['city', 'location', 'state', 'region'].includes(h)) return 'city';
    if (['leadstage', 'stage'].includes(h)) return 'leadStage';
    if (['leadstatus', 'status'].includes(h)) return 'leadStatus';
    if (['assignedto', 'assignee', 'agent', 'salesperson'].includes(h)) return 'assignedTo';
    if (['tags', 'tag', 'labels', 'label'].includes(h)) return 'tags';
    return '';
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];
        if (char === '"' && inQuotes && next === '"') {
            value += '"';
            i += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(value.trim());
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i += 1;
            row.push(value.trim());
            if (row.some(cell => cell !== '')) rows.push(row);
            row = [];
            value = '';
        } else {
            value += char;
        }
    }
    row.push(value.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
    const headers = rows[0] || [];
    return { headers, rows: rows.slice(1) };
}

// Small helper to pick the right icon for a channel type
function ChannelIcon({ type, name }) {
    if (name === 'XOLOX') return <Database size={14} className="text-blue-500" />;
    if (type === 'whatsapp') return <MessageCircle size={14} className="text-green-600" />;
    if (type === 'instagram') return <Instagram size={14} className="text-pink-600" />;
    return <User size={14} className="text-slate-500" />;
}

const CHANNEL_TYPE_LABELS = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    raw: 'System/API',
};

function channelLabel(ch) {
    if (ch.name === 'XOLOX') return 'XOLOX – API';
    return `${CHANNEL_TYPE_LABELS[ch.type] || ch.type} – ${ch.name}`;
}

// ──────────────────────────────────────────
// Contact Details Side Modal (Drawer)
// ──────────────────────────────────────────
function ContactDetailsPage({ contact, onBack, onDelete, onUpdate }) {
    const { toast } = useToast();
    const p = contact.profile || {};
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        display_name: contact.display_name || '',
        course: contact.course || p.course || '',
        lead_stage: contact.lead_stage || p.leadStage || '',
        lead_status: contact.lead_status || 'new'
    });

    const handleUpdateContact = async () => {
        setIsSaving(true);
        try {
            // Re-using a generic update contact API or creating one if needed
            // For now, we'll use putContact for direct Registry updates
            const res = await putContact(contact.id, editForm);
            if (res.success) {
                toast({ description: "Registry record updated", duration: 1200 });
                onUpdate(res.contact);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 w-full min-w-0 h-full bg-[#f5f3fb] px-6 py-6 overflow-y-auto">
            {/* Backdrop */}
            <div className="hidden" />

            {/* Slide-out Panel */}
            <div className="w-full bg-white shadow-sm border border-purple-100 rounded-[28px] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-7 py-6 border-b border-purple-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-gradient-to-br from-white via-purple-50/70 to-white">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-950">Lead Registry Details</h2>
                        <p className="text-xs text-slate-500 font-medium">Internal System ID: <span className="text-purple-600 font-bold">{contact.id.slice(0, 8)}...</span></p>
                    </div>
                    <button onClick={onBack} className="inline-flex items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-purple-50 hover:text-purple-700">
                        <ChevronLeft size={18} />
                        Back to Contacts
                    </button>
                </div>

                {/* Content */}
                <div className="px-7 py-7 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">

                    {/* Hero Section */}
                    <aside className="rounded-[24px] border border-purple-100 bg-gradient-to-br from-white via-white to-purple-50/70 p-6 shadow-sm space-y-5">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-purple-100 border-4 border-white ring-1 ring-purple-50">
                                {contact.display_name?.charAt(0).toUpperCase() || <User size={32} />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-lg shadow-md border border-slate-100 flex items-center justify-center">
                                <ChannelIcon type={contact.channel_type} name={contact.channel_name} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">{contact.display_name || 'Anonymous Lead'}</h3>
                            <div className="flex items-center justify-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                    {contact.channel_name}
                                </span>
                                {(contact.lead_stage || p.leadStage) && (
                                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-wider border border-orange-200">
                                        {contact.lead_stage || p.leadStage}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100/70 text-center">
                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Assigned Agent</p>
                            <p className="text-sm font-bold text-slate-700">{contact.assignee_name || contact.assigned_to || p.assignedTo || 'Unassigned'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100/50 text-center">
                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Selected Course</p>
                            <p className="text-sm font-bold text-slate-700">{contact.course || p.course || 'None'}</p>
                        </div>
                    </div>
                    </aside>

                    {/* Metadata Groups */}
                    <div className="space-y-6 min-w-0">
                        <section>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                <div className="h-px bg-slate-100 flex-1"></div>
                                Contact Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <DataField icon={<User size={14}/>} label="Full Identity" value={contact.display_name || 'N/A'} />
                                <DataField icon={<MessageCircle size={14}/>} label="Primary Mobile" value={contact.external_id} />
                                <DataField icon={<Download size={14}/>} label="Email Address" value={p.email || 'N/A'} />
                                <DataField icon={<RefreshCcw size={14}/>} label="Lead Source" value={p.leadSource || 'Direct Import'} />
                            </div>
                        </section>

                        <section>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                <div className="h-px bg-slate-100 flex-1"></div>
                                System Attributes
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <DataField label="Registered At" value={new Date(contact.created_at).toLocaleString()} />
                                <DataField label="Last XOLOX Sync" value={(contact.last_sync_at || p.syncedAt) ? new Date(contact.last_sync_at || p.syncedAt).toLocaleString() : 'Never'} />
                                <DataField label="Lead Score / ID" value={contact.lead_id || p.leadId || 'N/A'} />
                            </div>
                        </section>

                        <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Lead Categorization</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Lead Status (CRT Track)</label>
                                    <select
                                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                        value={editForm.lead_status}
                                        onChange={e => setEditForm(v => ({ ...v, lead_status: e.target.value }))}
                                    >
                                        {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Lead Stage (N2 Track)</label>
                                    <select
                                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                        value={editForm.lead_stage}
                                        onChange={e => setEditForm(v => ({ ...v, lead_stage: e.target.value }))}
                                    >
                                        <option value="">SELECT STAGE</option>
                                        {LEAD_STAGES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                        </section>

                        {contact.profile && Object.keys(contact.profile).length > 0 && (
                            <section>
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                    Raw Profile Snapshot
                                </h4>
                                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                                    <pre className="text-[11px] font-mono text-purple-200/90 leading-relaxed">
                                        {JSON.stringify(contact.profile, null, 2)}
                                    </pre>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-7 py-5 border-t border-purple-100 bg-slate-50/60 flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                        variant="outline"
                        className="font-bold text-xs border-red-100 text-red-600 hover:bg-red-50"
                        onClick={async () => {
                            const deleted = await onDelete(contact);
                            if (deleted) onBack();
                        }}
                    >
                        <Trash2 size={14} className="mr-2 text-red-500" />
                        DELETE RECORD
                    </Button>
                    <Button
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-100"
                        onClick={handleUpdateContact}
                        disabled={isSaving}
                    >
                        <ExternalLink size={14} className="mr-2" />
                        {isSaving ? 'SAVING...' : 'UPDATE DATA'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function DataField({ icon, label, value }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 min-w-0">
            {icon && <div className="mt-1 text-purple-400">{icon}</div>}
            <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
                <span className="text-sm font-semibold text-slate-700 break-words">{value}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────
// Add Contact Modal
// ──────────────────────────────────────────
function LeadInput({ label, value, onChange, placeholder, type = 'text' }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
            <input
                type={type}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                value={value}
                placeholder={placeholder}
                onChange={event => onChange(event.target.value)}
            />
        </div>
    );
}

function AddContactModal({ isOpen, onClose, channels, onSuccess }) {
    const emptyForm = (channelId = '') => ({
        channel_id: channelId,
        external_id: '',
        display_name: '',
        isLead: false,
        first_name: '',
        last_name: '',
        email: '',
        course: '',
        profession: '',
        city: '',
        locationCoordinates: null,
        lead_source: 'greeto_local',
        customFields: [],
    });
    const [form, setForm] = useState(() => emptyForm());
    const [rawJson, setRawJson] = useState('{}');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm(emptyForm(channels[0]?.id || ''));
            setRawJson('{}');
            setError('');
        }
    }, [isOpen, channels]);

    const selectedChannel = channels.find(c => c.id === form.channel_id);
    const isRaw = selectedChannel?.type === 'raw';

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Location services are not supported by this browser.');
            return;
        }
        setError('');
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const latitude = Number(coords.latitude.toFixed(6));
                const longitude = Number(coords.longitude.toFixed(6));
                setForm(current => ({
                    ...current,
                    city: current.city || `${latitude}, ${longitude}`,
                    locationCoordinates: { latitude, longitude },
                }));
                setLocating(false);
            },
            () => {
                setLocating(false);
                setError('Unable to get your location. Check the browser location permission and try again.');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.channel_id) { setError('Select a channel.'); return; }
        if (!form.external_id.trim()) { setError('Mobile/ID required.'); return; }
        if (form.isLead && !form.first_name.trim() && !form.display_name.trim()) {
            setError('First name or display name is required for a lead.');
            return;
        }

        setSaving(true);
        try {
            const customFields = form.customFields.reduce((fields, field) => {
                const key = field.key.trim();
                const value = field.value.trim();
                if (key && value) fields[key] = value;
                return fields;
            }, {});
            const displayName = form.isLead
                ? [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ') || form.display_name.trim()
                : form.display_name.trim();
            const leadProfile = form.isLead ? {
                firstName: form.first_name.trim(),
                lastName: form.last_name.trim(),
                email: form.email.trim(),
                course: form.course.trim(),
                profession: form.profession,
                city: form.city.trim(),
                location: form.city.trim(),
                locationCoordinates: form.locationCoordinates,
                source: form.lead_source.trim() || 'greeto_local',
                ...customFields,
            } : {};
            const res = await addContact({
                channel_id: form.channel_id,
                external_id: form.external_id.trim(),
                display_name: displayName || null,
                email: form.isLead ? form.email.trim() || null : null,
                course: form.isLead ? form.course.trim() || null : null,
                profession: form.isLead ? form.profession || null : null,
                city: form.isLead ? form.city.trim() || null : null,
                source: form.isLead ? form.lead_source.trim() || 'greeto_local' : undefined,
                profile: isRaw ? JSON.parse(rawJson) : leadProfile,
            });
            if (res.success) { onSuccess(res.contact); onClose(); }
            else setError(res.error || 'Failed.');
        } catch (err) {
            setError(err?.message || 'Unable to create the contact. Please try again.');
        }
        finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Contact">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Channel</label>
                    <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                        value={form.channel_id}
                        onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
                    >
                        {channels.map(ch => <option key={ch.id} value={ch.id}>{channelLabel(ch)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile / ID</label>
                    <input
                        type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                        value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display Name</label>
                    <input
                        type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                        value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                    />
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2.5">
                    <span>
                        <span className="block text-sm font-semibold text-slate-800">Create as lead</span>
                        <span className="block text-xs text-slate-500">Use course, location, and routing rules for this contact.</span>
                    </span>
                    <input type="checkbox" className="h-4 w-4 accent-purple-600" checked={form.isLead} onChange={e => setForm(f => ({ ...f, isLead: e.target.checked }))} />
                </label>
                {form.isLead && (
                    <section className="space-y-3 border-l-2 border-purple-200 pl-3" aria-label="Lead details">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <LeadInput label="First Name" value={form.first_name} onChange={value => setForm(f => ({ ...f, first_name: value }))} />
                            <LeadInput label="Last Name" value={form.last_name} onChange={value => setForm(f => ({ ...f, last_name: value }))} />
                            <LeadInput label="Email" type="email" value={form.email} onChange={value => setForm(f => ({ ...f, email: value }))} />
                            <LeadInput label="Lead Source" value={form.lead_source} onChange={value => setForm(f => ({ ...f, lead_source: value }))} />
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Course</label>
                                <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" value={form.course} onChange={event => setForm(f => ({ ...f, course: event.target.value }))}>
                                    <option value="">Select course</option>
                                    {COURSE_OPTIONS.map(course => <option key={course} value={course}>{course}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profession</label>
                                <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" value={form.profession} onChange={event => setForm(f => ({ ...f, profession: event.target.value }))}>
                                    <option value="">Select profession</option>
                                    {PROFESSION_OPTIONS.map(profession => <option key={profession} value={profession}>{profession}</option>)}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                                <div className="flex gap-2">
                                    <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" value={form.city} placeholder="For example, Bangalore" onChange={event => setForm(f => ({ ...f, city: event.target.value }))} />
                                    <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Use current location" title="Use current location" onClick={useCurrentLocation} disabled={locating}>
                                        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                                    </button>
                                </div>
                                {form.locationCoordinates && <p className="mt-1 text-xs text-slate-500">Current coordinates saved with this lead.</p>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase text-slate-500">Custom fields</label>
                                <button type="button" className="text-xs font-semibold text-purple-700 hover:text-purple-800" onClick={() => setForm(f => ({ ...f, customFields: [...f.customFields, { key: '', value: '' }] }))}>Add field</button>
                            </div>
                            {form.customFields.map((field, index) => (
                                <div key={index} className="flex gap-2">
                                    <input type="text" aria-label={`Custom field ${index + 1} name`} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500" value={field.key} onChange={e => setForm(f => ({ ...f, customFields: f.customFields.map((item, itemIndex) => itemIndex === index ? { ...item, key: e.target.value } : item) }))} placeholder="Field name" />
                                    <input type="text" aria-label={`Custom field ${index + 1} value`} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500" value={field.value} onChange={e => setForm(f => ({ ...f, customFields: f.customFields.map((item, itemIndex) => itemIndex === index ? { ...item, value: e.target.value } : item) }))} placeholder="Value" />
                                    <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Remove custom field" onClick={() => setForm(f => ({ ...f, customFields: f.customFields.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                {error && <div className="text-xs text-red-500 font-bold">{error}</div>}
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-100" disabled={saving}>
                        {saving ? 'Saving...' : 'Add Contact'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ──────────────────────────────────────────
// Main Contacts Page
// ──────────────────────────────────────────
function ImportContactsModal({ isOpen, onClose, channels, onImported }) {
    const fileRef = React.useRef(null);
    const { toast } = useToast();
    const [step, setStep] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [columnMap, setColumnMap] = useState({});
    const [channelId, setChannelId] = useState('');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setStep(0);
        setDragging(false);
        setFileName('');
        setHeaders([]);
        setRows([]);
        setColumnMap({});
        setChannelId(channels[0]?.id || '');
        setImporting(false);
        setError('');
        setResult(null);
    }, [isOpen, channels]);

    const loadFile = (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setError('Please upload a CSV file.');
            return;
        }
        setFileName(file.name);
        setError('');
        setResult(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            const parsed = parseCSV(event.target?.result || '');
            setHeaders(parsed.headers);
            setRows(parsed.rows);
            const nextMap = {};
            parsed.headers.forEach((header) => {
                nextMap[header] = autoMap(header);
            });
            setColumnMap(nextMap);
            if (parsed.headers.length) setStep(1);
            else setError('CSV has no readable header row.');
        };
        reader.readAsText(file);
    };

    const contactsToImport = useMemo(() => rows.map((row, rowIndex) => {
        const contact = { sourceRowNumber: rowIndex + 2 };
        headers.forEach((header, index) => {
            const field = columnMap[header];
            const value = row[index];
            if (field && value) contact[field] = value;
        });
        return contact;
    }).filter(contact => contact.firstName || contact.displayName || contact.email || contact.phone), [rows, headers, columnMap]);

    const mappedCount = Object.values(columnMap).filter(Boolean).length;
    const readyCount = contactsToImport.length;
    const skippedCount = Math.max(0, rows.length - readyCount);

    const handleImport = async () => {
        if (!channelId) {
            setError('Please select a channel.');
            return;
        }
        if (!readyCount) {
            setError('No valid contacts found. Map at least name, phone, or email.');
            return;
        }
        setImporting(true);
        setError('');
        setResult(null);
        try {
            const response = await importContactsBulk(channelId, contactsToImport);
            if (!response.success) throw new Error(response.error || response.message || 'Import failed');
            setResult(response);
            setStep(2);
            toast({ description: `Imported ${response.summary?.imported || 0} contacts`, duration: 1800 });
            onImported?.();
        } catch (err) {
            setError(err.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center px-4 py-6">
            <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[28px] bg-[#f8f5ff] shadow-2xl border border-white/70 flex flex-col">
                <div className="px-7 py-5 bg-white border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                            <CloudUpload size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-950">Import Contacts</h2>
                            <p className="text-sm font-semibold text-slate-500">Upload CSV, map fields, then review duplicate and failed rows.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-10 w-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-7 pt-5">
                    <div className="grid grid-cols-3 gap-3">
                        {IMPORT_STEPS.map((label, index) => (
                            <div key={label} className={`rounded-2xl px-4 py-3 border ${step === index ? 'bg-purple-700 text-white border-purple-700 shadow-lg shadow-purple-100' : 'bg-white text-slate-500 border-slate-200'}`}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Step {index + 1}</p>
                                <p className="text-sm font-semibold mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-6">
                    {step === 0 && (
                        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
                            <div
                                className={`min-h-[280px] rounded-[26px] border-2 border-dashed bg-white flex flex-col items-center justify-center text-center p-8 transition ${dragging ? 'border-purple-500 ring-4 ring-purple-100' : 'border-purple-200'}`}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragging(false);
                                    loadFile(e.dataTransfer.files?.[0]);
                                }}
                                onClick={() => fileRef.current?.click()}
                            >
                                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
                                <div className="h-16 w-16 rounded-3xl bg-purple-100 text-purple-700 flex items-center justify-center mb-5">
                                    <Upload size={30} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-950">Click or drag CSV file here</h3>
                                <p className="text-sm font-semibold text-slate-500 mt-2">Contacts will be imported safely. Duplicate phone/email rows are reported, not overwritten.</p>
                                {fileName && <p className="mt-5 rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">{fileName}</p>}
                            </div>

                            <div className="rounded-[26px] bg-white border border-slate-200 p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <Sparkles size={20} className="text-purple-600" />
                                    <h3 className="font-semibold text-slate-950">Greeto CSV Helper</h3>
                                </div>
                                <p className="text-sm font-semibold text-slate-500">Recommended columns: first name, last name, phone, email, course, lead stage, lead status, assigned to, tags.</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-purple-200 text-purple-700 font-semibold"
                                    onClick={() => downloadCsv('sample_contacts.csv', [
                                        ['first_name', 'last_name', 'phone', 'email', 'course', 'lead_stage', 'lead_status', 'assigned_to', 'tags'],
                                        ['Aarav', 'Mehta', '9876543210', 'aarav@example.com', 'ACCA', 'N2 Fresh Leads', 'new', 'Sales 01', 'fresh,whatsapp'],
                                    ])}
                                >
                                    <Download size={16} className="mr-2" />
                                    Download Sample CSV
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-5">
                            <div className="rounded-[26px] bg-white border border-slate-200 p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] mb-2">Import Channel</label>
                                    <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                                        {channels.map(ch => <option key={ch.id} value={ch.id}>{channelLabel(ch)}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-2xl bg-purple-50 p-4"><p className="text-xs font-semibold text-purple-500">Rows</p><p className="text-2xl font-bold">{rows.length}</p></div>
                                    <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-600">Ready</p><p className="text-2xl font-bold">{readyCount}</p></div>
                                    <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-600">Skipped</p><p className="text-2xl font-bold">{skippedCount}</p></div>
                                </div>
                                <p className="text-xs font-semibold text-slate-500">Mapped fields: {mappedCount}. Phone or email is required for a stable contact identity.</p>
                            </div>

                            <div className="rounded-[26px] bg-white border border-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-950">Map CSV Columns</h3>
                                    <span className="text-xs font-semibold text-purple-600">{fileName}</span>
                                </div>
                                <div className="max-h-[420px] overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">CSV Column</th>
                                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Map To</th>
                                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sample</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {headers.map((header, index) => (
                                                <tr key={header} className="border-t border-slate-100">
                                                    <td className="px-5 py-3 font-semibold text-slate-800">{header}</td>
                                                    <td className="px-5 py-3">
                                                        <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold outline-none focus:border-purple-500" value={columnMap[header] || ''} onChange={(e) => setColumnMap(map => ({ ...map, [header]: e.target.value }))}>
                                                            {IMPORT_FIELDS.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-500 max-w-[220px] truncate">{rows[0]?.[index] || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Data Preview */}
                            <div className="rounded-[26px] bg-white border border-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-950">Data Preview</h3>
                                    <span className="text-xs font-semibold text-slate-500">First 3 rows</span>
                                </div>
                                <div className="overflow-x-auto max-h-[300px]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Row</th>
                                                {headers.map(h => <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rows.slice(0, 3).map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    <td className="px-5 py-3 font-semibold text-slate-400">{rIdx + 1}</td>
                                                    {headers.map((h, cIdx) => (
                                                        <td key={cIdx} className="px-5 py-3 text-slate-700 whitespace-nowrap">{row[cIdx] || '-'}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid lg:grid-cols-4 gap-4">
                            {[
                                ['Total Rows', result?.summary?.total ?? rows.length, 'bg-slate-900 text-white'],
                                ['Imported', result?.summary?.imported ?? readyCount, 'bg-emerald-50 text-emerald-700'],
                                ['Duplicates', result?.summary?.duplicates ?? 0, 'bg-amber-50 text-amber-700'],
                                ['Failed', result?.summary?.failed ?? 0, 'bg-red-50 text-red-700'],
                            ].map(([label, value, color]) => (
                                <div key={label} className={`rounded-[24px] p-5 ${color}`}>
                                    <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
                                    <p className="text-2xl font-bold mt-2">{value}</p>
                                </div>
                            ))}
                            <div className="lg:col-span-4 rounded-[26px] bg-white border border-slate-200 p-6">
                                <h3 className="font-semibold text-slate-950 mb-4">Import Report</h3>
                                {!result ? (
                                    <div className="text-sm font-semibold text-slate-500">Review the summary, then finish the import.</div>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        <Button variant="outline" onClick={() => downloadCsv('imported_contacts.csv', reportRows(result, 'imported'))}>Download Imported</Button>
                                        <Button variant="outline" onClick={() => downloadCsv('duplicate_contacts.csv', reportRows(result, 'duplicates'))}>Download Duplicates</Button>
                                        <Button variant="outline" onClick={() => downloadCsv('failed_contacts.csv', reportRows(result, 'failed'))}>Download Failed Rows</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}
                </div>

                <div className="px-7 py-5 bg-white border-t border-purple-100 flex items-center justify-between">
                    <Button variant="outline" onClick={() => step === 0 ? onClose() : setStep(step - 1)} disabled={importing}>
                        {step === 0 ? 'Cancel' : 'Back'}
                    </Button>
                    <div className="flex gap-3">
                        {step === 0 && (
                            <Button className="bg-purple-700 hover:bg-purple-800 text-white font-semibold" onClick={() => headers.length ? setStep(1) : fileRef.current?.click()}>
                                {headers.length ? 'Continue Mapping' : 'Choose CSV'}
                            </Button>
                        )}
                        {step === 1 && (
                            <>
                                <Button variant="outline" onClick={() => setStep(2)}>Review</Button>
                                <Button className="bg-purple-700 hover:bg-purple-800 text-white font-semibold" onClick={handleImport} disabled={importing || !readyCount}>
                                    {importing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Check size={16} className="mr-2" />}
                                    Finish Import
                                </Button>
                            </>
                        )}
                        {step === 2 && (
                            <Button className="bg-purple-700 hover:bg-purple-800 text-white font-semibold" onClick={result ? onClose : handleImport} disabled={importing || !readyCount}>
                                {importing ? 'Importing...' : result ? 'Done' : 'Finish Import'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ContactsPage({ onNavigate }) {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);
    const [viewMode, setViewMode] = useState('table');

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);
    const [contactsError, setContactsError] = useState('');
    const [isXoloxConnected, setIsXoloxConnected] = useState(false);

    const [channels, setChannels] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedContact, setSelectedContact] = useState(null);
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    // Filter and Column Visibility State
    const [filters, setFilters] = useState({
        leadStage: '',
        leadStatus: '',
        course: '',
        assignedTo: '',
        source: 'all'
    });

    const [visibleColumns, setVisibleColumns] = useState({
        contact: true,
        channel: true,
        externalId: true,
        leadStage: true,
        leadStatus: true,
        course: true,
        assignedTo: true,
        source: false,
        syncAt: false,
        createdAt: true,
        actions: true
    });

    const fetchContacts = async (pageNum, search, activeFilters = filters, limit = rowsPerPage) => {
        setIsLoading(true);
        setContactsError('');
        try {
            const res = await getContacts(pageNum, limit, search, activeFilters);
            if (res.success) {
                setContacts(Array.isArray(res.contacts) ? res.contacts : []);
                setTotalPages(res.pagination?.totalPages || 1);
                setTotalContacts(res.pagination?.total || 0);
            } else {
                setContacts([]);
                setTotalPages(1);
                setTotalContacts(0);
                setContactsError(res.message || res.error || 'Contacts could not be loaded.');
            }
        } catch (e) {
            console.error('Failed to fetch contacts:', e);
            setContacts([]);
            setTotalPages(1);
            setTotalContacts(0);
            setContactsError(e.message || 'Contacts could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    };

    // New Background Sync Logic
    const handleSyncAll = async () => {
        setIsSyncing(true);
        try {
            setSyncProgress(`Requesting background sync...`);
            const res = await syncXoloxContacts(1, 100, true);
            if (res.success) {
                setSyncProgress(`Background sync started! Moving to status tracking...`);
                // Polling starts automatically via the useEffect below
            } else {
                alert(res.message || 'Sync failed');
                setIsSyncing(false);
            }
        } catch (e) {
            console.error('Backend Sync Error:', e);
            alert('Could not start background sync');
            setIsSyncing(false);
        }
    };

    // Background Status Polling
    useEffect(() => {
        let pollTimer;
        const checkStatus = async () => {
            try {
                const res = await getXoloxSyncStatus();
                if (res.success && res.status.isRunning) {
                    setIsSyncing(true);
                    const s = res.status;
                    const percent = s.totalPages > 0 ? Math.round((s.currentPage / s.totalPages) * 100) : 0;
                    setSyncProgress(`Background Sync: Page ${s.currentPage} of ${s.totalPages} (${percent}%) - ${s.syncedLeads} leads`);
                    if (s.currentPage % 20 === 0) fetchContacts(page, searchTerm);
                    pollTimer = setTimeout(checkStatus, 3000);
                } else if (res.success && res.status.completedTime) {
                    setIsSyncing(false);
                    if (syncProgress && syncProgress.includes('Sync')) {
                        setSyncProgress(`✅ Full sync finished! Total Synced: ${res.status.syncedLeads}`);
                        fetchContacts(1, searchTerm);
                        setTimeout(() => setSyncProgress(null), 10000);
                    }
                } else if (res.success && res.status.lastError) {
                    setIsSyncing(false);
                    setSyncProgress(`❌ Sync failed: ${res.status.lastError}`);
                }
            } catch (err) {
                console.warn('Status poll failed:', err);
            }
        };
        checkStatus();
        return () => clearTimeout(pollTimer);
    }, [page, searchTerm]);

    // Fetch channels for modal
    useEffect(() => {
        getContactChannels()
            .then(res => { if (res.success) setChannels(res.channels); })
            .catch(console.error);
    }, []);

    useEffect(() => {
        let cancelled = false;
        getGenericIntegrationSettings()
            .then((res) => {
                if (cancelled) return;
                const xolox = (res?.integrations || []).find((entry) => entry.provider_id === 'xolox-crm');
                setIsXoloxConnected(Boolean(xolox && xolox.is_active !== false));
            })
            .catch(() => { if (!cancelled) setIsXoloxConnected(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!isXoloxConnected && filters.source === 'xolox') {
            const nextFilters = { ...filters, source: 'all' };
            setFilters(nextFilters);
            setPage(1);
            fetchContacts(1, searchTerm, nextFilters);
        }
    }, [isXoloxConnected]);

    // Debounced search
    useEffect(() => {
        const handler = setTimeout(() => {
            setPage(1);
            fetchContacts(1, searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchContacts(newPage, searchTerm);
        }
    };

    const handleContactAdded = (newContact) => {
        setContacts(prev => [newContact, ...prev]);
        setTotalContacts(prev => prev + 1);
    };

    const handleContactUpdated = (updatedContact) => {
        setContacts(prev => prev.map(contact => contact.id === updatedContact.id ? updatedContact : contact));
        setSelectedContact(updatedContact);
    };

    const handleDeleteContact = async (contact) => {
        if (!(await confirmAction({
            title: 'Delete contact?',
            message: `This will remove ${contact.display_name || contact.external_id || 'this contact'}.`,
            confirmLabel: 'Delete contact',
            tone: 'danger',
        }))) return false;
        try {
            const res = await deleteContact(contact.id);
            if (res.success) {
                setContacts(prev => prev.filter(c => c.id !== contact.id));
                setTotalContacts(prev => prev - 1);
                return true;
            }
        } catch (err) { console.error(err); }
        return false;
    };

    if (selectedContact) {
        return (
            <ContactDetailsPage
                contact={selectedContact}
                onBack={() => setSelectedContact(null)}
                onDelete={handleDeleteContact}
                onUpdate={handleContactUpdated}
            />
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-auto bg-[#f5f3fb]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 z-10">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Contacts</h1>
                        <div className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-[11px] font-bold uppercase tracking-wider border border-purple-100">
                            {totalContacts} Total
                        </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-1">Manage synced leads, channel contacts, assignments, stages and source data.</p>
                </div>

                <div className="flex items-center space-x-3">
                    {syncProgress && (
                        <div className="text-xs font-semibold text-purple-600 animate-pulse hidden md:block mr-2 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100 italic">
                            {syncProgress}
                        </div>
                    )}

                    {isXoloxConnected ? (
                        <Button
                            variant="outline"
                            className={`flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50 relative overflow-hidden ${isSyncing ? 'pointer-events-none opacity-80' : ''}`}
                            onClick={() => handleSyncAll()}
                        >
                            <RefreshCcw size={16} className={isSyncing ? 'animate-spin' : ''} />
                            <span className="font-semibold">{isSyncing ? 'Batch Syncing...' : 'Sync with XOLOX'}</span>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50"
                            onClick={() => onNavigate?.('integrations')}
                        >
                            <RefreshCcw size={16} />
                            <span className="font-semibold">Connect XOLOX CRM</span>
                        </Button>
                    )}

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                    <Button
                        variant="outline"
                        className="flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowImportModal(true)}
                    >
                        <Upload size={16} />
                        <span className="hidden sm:inline font-semibold">Import</span>
                    </Button>
                    <Button
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-100 transition-all font-semibold"
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={16} />
                        <span>Add Contact</span>
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 pb-6">
                <div className="max-w-[1480px] mx-auto flex gap-5">
                    <aside className="hidden lg:block w-60 shrink-0 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.16em] mb-3">Segments</p>
                            <div className="space-y-1">
                                {[
                                    { label: 'All Contacts', value: 'all', count: totalContacts },
                                    { label: 'New Leads', value: 'new', count: contacts.filter(c => (c.lead_status || c.profile?.leadStatus) === 'new').length },
                                    { label: 'Contacted', value: 'contacted', count: contacts.filter(c => (c.lead_status || c.profile?.leadStatus) === 'contacted').length },
                                    { label: 'Won', value: 'won', count: contacts.filter(c => (c.lead_status || c.profile?.leadStatus) === 'won').length },
                                    { label: 'Lost', value: 'lost', count: contacts.filter(c => (c.lead_status || c.profile?.leadStatus) === 'lost').length },
                                ].map(item => {
                                    const isActive = item.value === 'all'
                                        ? !filters.leadStatus
                                        : filters.leadStatus === item.value;
                                    return (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => {
                                                const nf = item.value === 'all'
                                                    ? { leadStage: '', leadStatus: '', course: '', assignedTo: '' }
                                                    : { ...filters, leadStatus: item.value };
                                                setFilters(nf);
                                                setPage(1);
                                                fetchContacts(1, searchTerm, nf);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
                                                isActive
                                                    ? 'bg-purple-50 text-purple-700 font-semibold'
                                                    : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'
                                            }`}
                                        >
                                            <span>{item.label}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                isActive ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {item.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Filters</p>
                            <div className="flex flex-wrap gap-2">
                                {LEAD_STAGES.slice(0, 5).map(stage => (
                                    <button
                                        key={stage}
                                        type="button"
                                        onClick={() => {
                                            const nf = { ...filters, leadStage: filters.leadStage === stage ? '' : stage };
                                            setFilters(nf);
                                            setPage(1);
                                            fetchContacts(1, searchTerm, nf);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg border text-xs ${
                                            filters.leadStage === stage
                                                ? 'border-purple-300 bg-purple-50 text-purple-700 font-semibold'
                                                : 'border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-600'
                                        }`}
                                    >
                                        {stage}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <div className="flex-1 min-w-0 space-y-4">

                    {/* Search & Filters */}
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by name, ID or mobile..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm outline-none focus:ring-4 focus:ring-purple-50 focus:border-purple-500 transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                    fetchContacts(1, e.target.value, filters);
                                }}
                            />
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <ViewToggle value={viewMode} onChange={setViewMode} className="shrink-0" />

                            <select
                                aria-label="Contact source"
                                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.source}
                                onChange={(e) => {
                                    const nf = { ...filters, source: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="all">Source: All</option>
                                <option value="local">Source: Local</option>
                                {isXoloxConnected && <option value="xolox">Source: Xolox CRM</option>}
                            </select>

                            <select
                                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.leadStage}
                                onChange={(e) => {
                                    const nf = { ...filters, leadStage: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Stage: All</option>
                                {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <select
                                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.leadStatus}
                                onChange={(e) => {
                                    const nf = { ...filters, leadStatus: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Status: All</option>
                                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>

                            <select
                                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.course}
                                onChange={(e) => {
                                    const nf = { ...filters, course: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Course: All</option>
                                <option value="CPA">CPA</option>
                                <option value="CMA USA">CMA USA</option>
                                <option value="ACCA">ACCA</option>
                                <option value="EA">EA</option>
                            </select>

                            <select
                                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.assignedTo}
                                onChange={(e) => {
                                    const nf = { ...filters, assignedTo: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Agent: All</option>
                                <option value="Test User">Test User</option>
                            </select>

                            <div className="relative ml-1">
                                <Button
                                    variant="outline"
                                    className={`flex items-center gap-2 bg-slate-50 shadow-sm border-slate-200 text-slate-600 h-10 px-3 rounded-xl ${showColumnMenu ? 'ring-2 ring-purple-500/20 border-purple-200' : ''}`}
                                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                                >
                                    <Filter size={14} className="text-slate-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Columns</span>
                                </Button>
                                {showColumnMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2 transform origin-top-right transition-all whitespace-normal">
                                        <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 -mx-2 -mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visibility Control</span>
                                        </div>
                                        <div className="max-h-[350px] overflow-y-auto space-y-0.5 custom-scrollbar pb-1">
                                            {Object.keys(visibleColumns).map(col => (
                                                <div
                                                    key={col}
                                                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-purple-50/70 rounded-lg cursor-pointer transition-all group/item select-none"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
                                                    }}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleColumns[col] ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-300'}`}>
                                                        {visibleColumns[col] && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                    <span className={`text-xs font-semibold capitalize transition-colors ${visibleColumns[col] ? 'text-purple-700' : 'text-slate-500'}`}>
                                                        {col.replace(/([A-Z])/g, ' $1')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {viewMode === 'board' && (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {isLoading ? (
                                <div className="col-span-full rounded-2xl border border-slate-100 bg-white p-10 shadow-sm">
                                    <GreetoLoader label="Loading contacts..." sublabel="Fetching filtered leads" />
                                </div>
                            ) : contactsError ? (
                                <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
                                    {contactsError}
                                </div>
                            ) : contacts.length === 0 ? (
                                <div className="col-span-full rounded-3xl border border-dashed border-violet-200 bg-white">
                                    <WorkspaceEmptyState
                                        title={filters.source === 'xolox' ? 'Connect XOLOX CRM to view synced contacts' : 'Add your first contact'}
                                        description={filters.source === 'xolox' ? 'Synced CRM contacts stay hidden until this workspace reconnects to XOLOX. Local contacts are kept separately and remain available.' : 'Start manually, import a CSV, or connect a CRM or messaging channel when your workspace is ready.'}
                                        primaryLabel="Add contact"
                                        onPrimary={() => setShowAddModal(true)}
                                        secondaryLabel={filters.source === 'xolox' ? 'Connect XOLOX CRM' : 'Import contacts'}
                                        onSecondary={() => filters.source === 'xolox' ? onNavigate?.('integrations') : setShowImportModal(true)}
                                    />
                                    <button type="button" onClick={() => onNavigate?.('integrations')} className="mb-8 text-sm font-medium text-violet-700 hover:text-violet-900">
                                        Connect a CRM or channel instead
                                    </button>
                                </div>
                            ) : contacts.map(contact => {
                                const p = contact.profile || {};
                                const name = contact.display_name || 'Anonymous';
                                const stage = contact.lead_stage || p.leadStage || 'No stage';
                                const status = contact.lead_status || p.leadStatus || 'No status';
                                const assignedTo = contact.assignee_name || contact.assigned_to || p.assignedTo || 'Unassigned';

                                return (
                                    <div key={contact.id} className="group rounded-[22px] border border-purple-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-100/50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-base font-bold text-purple-700">
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <button type="button" onClick={() => setSelectedContact(contact)} className="block truncate text-left text-base font-semibold text-slate-950 transition hover:text-purple-700">
                                                        {name}
                                                    </button>
                                                    <p className="truncate text-xs font-semibold text-slate-400">{contact.email || p.email || 'No email'}</p>
                                                </div>
                                            </div>
                                            <ChannelIcon type={contact.channel_type} name={contact.channel_name} />
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                                            <div className="rounded-2xl bg-slate-50 p-3">
                                                <p className="font-semibold uppercase tracking-widest text-slate-400">Mobile/ID</p>
                                                <p className="mt-1 truncate font-semibold text-slate-800">{contact.external_id || '-'}</p>
                                            </div>
                                            <div className="rounded-2xl bg-purple-50 p-3">
                                                <p className="font-semibold uppercase tracking-widest text-purple-400">Assigned</p>
                                                <p className="mt-1 truncate font-semibold text-purple-800">{assignedTo}</p>
                                            </div>
                                            <div className="rounded-2xl bg-amber-50 p-3">
                                                <p className="font-semibold uppercase tracking-widest text-amber-500">Stage</p>
                                                <p className="mt-1 truncate font-semibold text-amber-800">{stage}</p>
                                            </div>
                                            <div className="rounded-2xl bg-emerald-50 p-3">
                                                <p className="font-semibold uppercase tracking-widest text-emerald-500">Status</p>
                                                <p className="mt-1 truncate font-semibold capitalize text-emerald-800">{status}</p>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : 'No date'}
                                            </p>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-purple-50 hover:text-purple-700" onClick={() => setSelectedContact(contact)}>
                                                    <ExternalLink size={15} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteContact(contact)}>
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Table */}
                    {viewMode === 'table' && <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden border-separate">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                                    <tr>
                                        {visibleColumns.contact && <th className="px-6 py-4">Identity</th>}
                                        {visibleColumns.channel && <th className="px-6 py-4">Channel</th>}
                                        {visibleColumns.externalId && <th className="px-6 py-4">Mobile/ID</th>}
                                        {visibleColumns.leadStage && <th className="px-6 py-4">Lead Stage</th>}
                                        {visibleColumns.leadStatus && <th className="px-6 py-4">Lead Status</th>}
                                        {visibleColumns.course && <th className="px-6 py-4">Course</th>}
                                        {visibleColumns.assignedTo && <th className="px-6 py-4">Assigned To</th>}
                                        {visibleColumns.source && <th className="px-6 py-4">Source</th>}
                                        {visibleColumns.syncAt && <th className="px-6 py-4">Synced At</th>}
                                        {visibleColumns.createdAt && <th className="px-6 py-4">Created At</th>}
                                        {visibleColumns.actions && <th className="px-6 py-4 text-right"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="10" className="px-6 py-20 text-center">
                                                <div className="flex justify-center">
                                                    <GreetoLoader label="Loading contacts..." sublabel="Fetching filtered leads" />
                                                </div>
                                            </td>
                                        </tr>
                                    ) : contactsError ? (
                                        <tr>
                                            <td colSpan="10" className="px-6 py-16 text-center text-sm font-semibold text-red-700 bg-red-50">{contactsError}</td>
                                        </tr>
                                    ) : contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="p-0">
                                                <WorkspaceEmptyState
                                                    title={filters.source === 'xolox' ? 'XOLOX CRM is not connected' : 'Your contact list is ready'}
                                                    description={filters.source === 'xolox' ? 'Synced CRM contacts are intentionally hidden while XOLOX is disconnected. Local contacts and imports are never deleted.' : 'Create a contact or import a list to begin managing leads in this workspace.'}
                                                    primaryLabel="Add contact"
                                                    onPrimary={() => setShowAddModal(true)}
                                                    secondaryLabel={filters.source === 'xolox' ? 'Open integrations' : 'Import contacts'}
                                                    onSecondary={() => filters.source === 'xolox' ? onNavigate?.('integrations') : setShowImportModal(true)}
                                                />
                                            </td>
                                        </tr>
                                    ) : (
                                        contacts.map(contact => {
                                            const p = contact.profile || {};
                                            return (
                                                <tr key={contact.id} className="hover:bg-purple-50/30 transition-all group not-italic">
                                                    {visibleColumns.contact && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm border-2 ${(contact.last_sync_at || p.syncedAt) ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                                                    {contact.display_name?.charAt(0).toUpperCase() || <User size={18} />}
                                                                </div>
                                                                <div className="flex flex-col min-w-0 cursor-pointer group/name" onClick={() => setSelectedContact(contact)}>
                                                                    <span className="font-bold text-slate-900 truncate max-w-[150px] group-hover/name:text-purple-600 transition-colors">{contact.display_name || 'Anonymous'}</span>
                                                                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">{contact.email || p.email || 'No email'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.channel && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <ChannelIcon type={contact.channel_type} name={contact.channel_name} />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    {contact.channel_name === 'XOLOX' ? 'Synced' : contact.channel_type}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.externalId && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700">{contact.external_id}</span>
                                                                {(contact.lead_id || p.leadId) && <span className="text-[9px] text-purple-500 font-bold">ID: {contact.lead_id || p.leadId}</span>}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.leadStage && (
                                                        <td className="px-6 py-4">
                                                            {(contact.lead_stage || p.leadStage) ? (
                                                                <div className="inline-flex items-center px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 uppercase tracking-tight">
                                                                    {contact.lead_stage || p.leadStage}
                                                                </div>
                                                            ) : <span className="text-slate-300 italic text-[10px]">None</span>}
                                                        </td>
                                                    )}
                                                    {visibleColumns.leadStatus && (
                                                        <td className="px-6 py-4">
                                                            {(contact.lead_status || p.leadStatus) ? (
                                                                <div className="inline-flex items-center px-2 py-1 rounded bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-100 uppercase tracking-tight">
                                                                    {contact.lead_status || p.leadStatus}
                                                                </div>
                                                            ) : <span className="text-slate-300 italic text-[10px]">None</span>}
                                                        </td>
                                                    )}
                                                    {visibleColumns.course && (
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px] block">{contact.course || p.course || '—'}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.assignedTo && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">{(contact.assignee_name || contact.assigned_to || p.assignedTo || 'U').charAt(0)}</div>
                                                                <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">{contact.assignee_name || contact.assigned_to || p.assignedTo || 'Unassigned'}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.source && <td className="px-6 py-4 text-xs text-slate-500">{p.leadSource || 'Direct'}</td>}
                                                    {visibleColumns.syncAt && (
                                                        <td className="px-6 py-4 text-[10px] text-slate-400 font-medium">
                                                            {p.syncedAt ? new Date(p.syncedAt).toLocaleDateString() : 'Never'}
                                                        </td>
                                                    )}
                                                    {visibleColumns.createdAt && (
                                                        <td className="px-6 py-4 text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                            {new Date(contact.created_at).toLocaleDateString()}
                                                        </td>
                                                    )}
                                                    {visibleColumns.actions && (
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                                                                <Button
                                                                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                                    onClick={() => setSelectedContact(contact)}
                                                                >
                                                                    <ExternalLink size={16} />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    onClick={() => handleDeleteContact(contact)}
                                                                ><Trash2 size={16} /></Button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!isLoading && totalContacts > 0 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-6">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                        <span className="text-slate-900">{(page-1)*rowsPerPage + 1}-{Math.min(page*rowsPerPage, totalContacts)}</span> OF {totalContacts}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rows:</span>
                                        <select
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                const newLimit = Number(e.target.value);
                                                setRowsPerPage(newLimit);
                                                setPage(1);
                                                fetchContacts(1, searchTerm, filters, newLimit);
                                            }}
                                            className="bg-transparent text-[11px] font-bold text-slate-600 outline-none cursor-pointer border-b border-slate-300 focus:border-purple-500 pb-0.5"
                                        >
                                            <option value={10}>10</option>
                                            <option value={15}>15</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page === 1}
                                            onClick={() => handlePageChange(page - 1)}
                                            className="h-8 px-3 text-[11px] font-bold bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                                        >
                                            <ChevronLeft size={14} className="mr-1" />
                                            PREV
                                        </Button>

                                        <div className="relative group/page">
                                            <select
                                                value={page}
                                                onChange={(e) => handlePageChange(Number(e.target.value))}
                                                className="h-8 pl-3 pr-8 bg-purple-600 text-white text-xs font-bold rounded shadow-sm appearance-none cursor-pointer outline-none hover:bg-purple-700 transition-colors border-none ring-offset-2 focus:ring-2 focus:ring-purple-500"
                                            >
                                                {Array.from({ length: Math.min(totalPages, 5000) }, (_, i) => i + 1).map(p => (
                                                    <option key={p} value={p} className="bg-white text-slate-900 font-semibold">{p}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none group-hover/page:text-white transition-colors" />
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page === totalPages}
                                            onClick={() => handlePageChange(page + 1)}
                                            className="h-8 px-3 text-[11px] font-bold bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                                        >
                                            NEXT
                                            <ChevronRight size={14} className="ml-1" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>}

                    </div>
                </div>
            </div>

            {/* Add Contact Modal */}
            <AddContactModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                channels={channels}
                onSuccess={handleContactAdded}
            />

            <ImportContactsModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                channels={channels}
                onImported={() => {
                    setPage(1);
                    fetchContacts(1, searchTerm, filters);
                }}
            />

        </div>
    );
}
