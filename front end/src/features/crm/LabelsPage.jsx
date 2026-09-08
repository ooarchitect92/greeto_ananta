import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Tag, Plus, Search, Users, Trash2, Upload, ChevronRight, X, Check,
    UserPlus, FileText, Eye, Sparkles, Layers, UserRoundCheck, CircleDot,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import ViewToggle from '../../components/ui/ViewToggle.jsx';
import {
    getLabels, deleteLabel,
    createLabelWithContacts, createLabelFromCsv, addContactsToLabel,
    getContacts, getLabelContacts,
} from './api.js';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import WorkspaceEmptyState from '../../components/ui/WorkspaceEmptyState.jsx';

// ─── Parse a CSV file client-side and return rows ─────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    return lines.slice(1).map(line => {
        const cells = line.split(',').map(c => c.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] || ''; });
        return row;
    }).filter(r => r.external_id || r['phone number'] || r.phone);
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function Tab({ active, onClick, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-purple-700'
                }`}
        >
            <Icon size={15} />
            {label}
        </button>
    );
}

// ─── Create / Edit Group Modal ─────────────────────────────────────────────────
function GroupModal({ isOpen, onClose, editLabel, onSuccess }) {
    const [name, setName] = useState('');
    const [tab, setTab] = useState('select'); // 'select' | 'csv'
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // --- Select-from-existing tab ---
    const [allContacts, setAllContacts] = useState([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loadingContacts, setLoadingContacts] = useState(false);

    // --- CSV tab ---
    const [csvRows, setCsvRows] = useState([]);  // parsed rows preview
    const [csvFile, setCsvFile] = useState(null);
    const fileRef = useRef();

    const isEdit = !!editLabel;

    useEffect(() => {
        if (!isOpen) return;
        setName(editLabel?.name || '');
        setTab('select');
        setError('');
        setCsvRows([]);
        setCsvFile(null);

        setLoadingContacts(true);
        getContacts(1, 200, '')
            .then(res => {
                if (res.success) setAllContacts(res.contacts);
            })
            .catch(console.error)
            .finally(() => setLoadingContacts(false));

        // If editing, pre-select existing contacts
        if (editLabel) {
            getLabelContacts(editLabel.id)
                .then(res => {
                    if (res.success) setSelectedIds(new Set(res.contacts.map(c => c.id)));
                })
                .catch(console.error);
        } else {
            setSelectedIds(new Set());
        }
    }, [isOpen, editLabel]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCsvFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setCsvRows(parseCSV(ev.target.result));
        reader.readAsText(file);
    };

    const toggleContact = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isEdit && !name.trim()) { setError('Group name is required.'); return; }

        const contactIds = tab === 'select'
            ? [...selectedIds]
            : []; // CSV contacts are created server-side (not yet implemented here – show count)

        if (contactIds.length === 0 && tab === 'select') {
            setError('Please select at least one contact.');
            return;
        }
        if (tab === 'csv' && csvRows.length === 0) {
            setError('Please upload a valid CSV file with contacts.');
            return;
        }

        setSaving(true);
        try {
            if (isEdit) {
                // Adding contacts to existing label
                const res = await addContactsToLabel(editLabel.id, contactIds);
                if (res.success) {
                    onSuccess({ ...editLabel, assigned_count: res.total });
                    onClose();
                } else setError(res.error || 'Failed to update group.');
            } else {
                // CSV import creates tenant-scoped contacts and attaches them to the label.
                const res = tab === 'csv'
                    ? await createLabelFromCsv(name.trim(), csvFile)
                    : await createLabelWithContacts(name.trim(), contactIds);
                if (res.success) {
                    onSuccess(res.label);
                    onClose();
                } else setError(res.error || 'Failed to create group.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const filteredContacts = allContacts.filter(c => {
        const q = contactSearch.toLowerCase();
        return (c.display_name || '').toLowerCase().includes(q) || c.external_id.toLowerCase().includes(q);
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? `Add Contacts to "${editLabel.name}"` : 'Create New Group'}
            className="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-5">

                {/* Name (only when creating) */}
                {!isEdit && (
                    <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-white p-4 shadow-sm">
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Group Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="h-12 w-full rounded-2xl border border-purple-100 bg-white px-4 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                            placeholder="e.g. Hot Leads Q1"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                )}

                {/* Tabs */}
                <div className="rounded-2xl border border-purple-100 bg-white px-2 shadow-sm">
                    <div className="border-b border-slate-100 flex gap-0">
                    <Tab active={tab === 'select'} onClick={() => setTab('select')} icon={UserPlus} label="Select from Contacts" />
                    <Tab active={tab === 'csv'} onClick={() => setTab('csv')} icon={FileText} label="Upload CSV" />
                    </div>
                </div>

                {/* ── Select tab ── */}
                {tab === 'select' && (
                    <div className="space-y-3 rounded-3xl border border-purple-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Choose Contacts</p>
                                <p className="text-xs text-slate-400">Search and add contacts into this label.</p>
                            </div>
                            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 border border-purple-100">
                                {selectedIds.size} selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition focus-within:border-purple-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-purple-100">
                                <Search size={14} className="text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    className="w-full text-sm bg-transparent outline-none placeholder-slate-400"
                                    value={contactSearch}
                                    onChange={e => setContactSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-100">
                            {loadingContacts ? (
                                <GreetoLoader label="Loading contacts..." sublabel="Fetching contacts for label assignment" />
                            ) : filteredContacts.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">No contacts found.</p>
                            ) : filteredContacts.map(c => {
                                const selected = selectedIds.has(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => toggleContact(c.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-purple-50' : 'hover:bg-purple-50/50'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'
                                            }`}>
                                            {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                            {(c.display_name || c.external_id || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-slate-900 truncate">
                                                {c.display_name || 'Unknown Contact'}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono truncate">{c.external_id}</div>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase shrink-0">{c.channel_type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── CSV tab ── */}
                {tab === 'csv' && (
                    <div className="space-y-4 rounded-3xl border border-purple-100 bg-white p-4 shadow-sm">
                        <div>
                            <p className="text-sm font-bold text-slate-900">Upload Contact CSV</p>
                            <p className="text-xs text-slate-400">Import contacts and attach them to this label in one flow.</p>
                        </div>
                        <div
                            className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-8 transition-colors hover:border-purple-400 hover:bg-purple-50"
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload size={28} className="text-slate-400 mb-3" />
                            <p className="text-sm font-medium text-slate-700">Click to upload CSV</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Required columns: <code>external_id</code>, optional: <code>display_name</code>
                            </p>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        {csvFile && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                                <FileText size={18} className="text-purple-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-800 truncate">{csvFile.name}</p>
                                    <p className="text-xs text-slate-500">{csvRows.length} contact rows detected</p>
                                </div>
                                <button type="button" onClick={() => { setCsvFile(null); setCsvRows([]); fileRef.current.value = ''; }}>
                                    <X size={16} className="text-slate-400 hover:text-red-500" />
                                </button>
                            </div>
                        )}

                        {csvRows.length > 0 && (
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 text-xs">
                                <table className="w-full">
                                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                        <tr>
                                            {Object.keys(csvRows[0]).map(k => (
                                                <th key={k} className="px-3 py-2 text-left font-medium">{k}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {csvRows.slice(0, 10).map((row, i) => (
                                            <tr key={i}>
                                                {Object.values(row).map((v, j) => (
                                                    <td key={j} className="px-3 py-2 text-slate-700 font-mono">{v}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {csvRows.length > 10 && (
                                    <p className="text-center text-slate-400 py-2">... and {csvRows.length - 10} more rows</p>
                                )}
                            </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
                            <strong>Note:</strong> CSV upload will create new contacts if they don't already exist, then add them to this group. This feature requires the backend to be running.
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                        <X size={14} />
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 border-t border-purple-50 pt-4">
                    <Button type="button" variant="outline" className="rounded-2xl border-purple-100 bg-white hover:bg-purple-50" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" className="rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-md shadow-purple-100 hover:from-purple-800 hover:to-fuchsia-700" disabled={saving}>
                        {saving ? 'Saving...' : isEdit ? 'Add to Group' : 'Create Group'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ─── View Contacts Modal ───────────────────────────────────────────────────────
function ViewContactsModal({ isOpen, onClose, label }) {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewSearch, setViewSearch] = useState('');

    useEffect(() => {
        if (!isOpen || !label) return;
        setViewSearch('');
        setLoading(true);
        getLabelContacts(label.id)
            .then(res => { if (res.success) setContacts(res.contacts); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [isOpen, label]);

    const visibleContacts = contacts.filter(contact => {
        const query = viewSearch.toLowerCase();
        return (contact.display_name || '').toLowerCase().includes(query) || String(contact.external_id || '').toLowerCase().includes(query);
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Contacts in "${label?.name}"`} className="max-w-2xl">
            <div className="space-y-4">
                <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold text-slate-900">{label?.name}</p>
                            <p className="text-xs text-slate-500">Contacts attached to this audience label.</p>
                        </div>
                        <span className="rounded-full bg-gradient-to-r from-purple-700 to-fuchsia-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-purple-100">
                            {contacts.length} contacts
                        </span>
                    </div>
                </div>

                <div className="flex items-center w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-all focus-within:border-purple-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-purple-100">
                    <Search className="w-4 h-4 text-slate-400 mr-2" />
                    <input
                        type="text"
                        placeholder="Search contacts in this label..."
                        className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                        value={viewSearch}
                        onChange={e => setViewSearch(e.target.value)}
                    />
                </div>

                {loading ? (
                    <GreetoLoader label="Loading contacts..." sublabel="Fetching label members" />
                ) : contacts.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/40 px-5 py-10 text-center">
                        <Users size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">No contacts in this group yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Use Add Contacts to attach people to this label.</p>
                    </div>
                ) : visibleContacts.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/40 px-5 py-10 text-center">
                        <p className="text-sm font-semibold text-slate-600">No matching contacts found.</p>
                        <p className="text-xs text-slate-400 mt-1">Try a different name or phone search.</p>
                    </div>
                ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-3xl border border-purple-100 bg-white shadow-sm">
                        {visibleContacts.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-purple-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-sm shadow-purple-100">
                                    {(c.display_name || c.external_id || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900">{c.display_name || 'Unknown'}</p>
                                    <p className="text-xs text-slate-500 font-mono">{c.external_id}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase">{c.channel_type}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex justify-end border-t border-purple-50 pt-2">
                    <Button variant="outline" className="rounded-2xl border-purple-100 bg-white hover:bg-purple-50" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Main Labels Page ──────────────────────────────────────────────────────────
export default function LabelsPage({ onNavigate }) {
    const [labels, setLabels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('table');

    const [showModal, setShowModal] = useState(false);
    const [editLabel, setEditLabel] = useState(null);    // null = create mode

    const [viewLabel, setViewLabel] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);

    const fetchLabels = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getLabels();
            if (res.success) setLabels(res.labels);
        } catch (e) {
            console.error('Failed to fetch labels:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchLabels(); }, [fetchLabels]);

    const handleDelete = async (id) => {
        if (!(await confirmAction({
            title: 'Delete label group?',
            message: 'Delete this group? Contacts will NOT be deleted.',
            confirmLabel: 'Delete group',
            tone: 'danger',
        }))) return;
        try {
            const res = await deleteLabel(id);
            if (res.success) setLabels(prev => prev.filter(l => l.id !== id));
        } catch {
            console.error('Failed to delete label');
        }
    };

    const handleSuccess = (updatedLabel) => {
        setLabels(prev => {
            const existing = prev.find(l => l.id === updatedLabel.id);
            if (existing) return prev.map(l => l.id === updatedLabel.id ? { ...l, ...updatedLabel } : l);
            return [updatedLabel, ...prev];
        });
    };

    const openCreate = () => { setEditLabel(null); setShowModal(true); };
    const openEdit = (label) => { setEditLabel(label); setShowModal(true); };
    const openView = (label) => { setViewLabel(label); setShowViewModal(true); };

    const filtered = labels.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalAssignedContacts = labels.reduce((sum, label) => sum + Number(label.assigned_count || 0), 0);
    const emptyGroups = labels.filter(label => Number(label.assigned_count || 0) === 0).length;

    return (
        <div className="flex-1 flex flex-col h-full overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_34%),#f6f2fb]">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0">
              <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/95 p-6 shadow-sm shadow-purple-100/70">
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-purple-100/80 blur-3xl" />
                <div className="pointer-events-none absolute -left-14 bottom-0 h-40 w-40 rounded-full bg-fuchsia-100/60 blur-3xl" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-500 text-white shadow-xl shadow-purple-200">
                      <Layers size={28} />
                    </div>
                    <div>
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-500">
                        <Sparkles size={14} />
                        Audience Builder
                    </p>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Contact Groups</h1>
                        <div className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-[11px] font-bold uppercase tracking-wider border border-purple-100">
                            {labels.length} Labels
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium mt-1">Create audience labels and attach contacts for campaigns, broadcasts and follow-ups.</p>
                    </div>
                  </div>
                <Button className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 font-semibold text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700" onClick={openCreate}>
                    <Plus size={16} />
                    Create Group
                </Button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 pb-6">
                <div className="max-w-[1480px] mx-auto flex gap-5">
                    <aside className="hidden lg:block w-64 shrink-0 space-y-4">
                        <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.16em] mb-3">Overview</p>
                            <div className="space-y-2">
                                {[
                                    { label: 'Total Groups', value: labels.length, Icon: Layers },
                                    { label: 'Assigned Contacts', value: totalAssignedContacts, Icon: UserRoundCheck },
                                    { label: 'Empty Groups', value: emptyGroups, Icon: CircleDot },
                                ].map(({ label, value, Icon }) => (
                                    <div key={label} className="flex items-center justify-between rounded-2xl bg-purple-50/60 px-3 py-2.5 transition hover:bg-purple-50">
                                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
                                          <Icon size={14} className="shrink-0 text-purple-500" />
                                          <span className="truncate">{label}</span>
                                        </span>
                                        <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.16em] mb-3">Create Flow</p>
                            <div className="space-y-2 text-xs text-slate-500">
                                <div className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 font-semibold text-purple-700">1. Create group name</div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">2. Select existing contacts</div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">3. Or upload CSV contacts</div>
                            </div>
                        </div>
                    </aside>

                    <div className="flex-1 min-w-0 space-y-4">

                    {/* Search */}
                    <div className="flex flex-col gap-3 rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-sm shadow-purple-100/60 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-all focus-within:border-purple-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-purple-100">
                            <Search className="w-5 h-5 text-slate-400 mr-2" />
                            <input
                                type="text"
                                placeholder="Search groups by name..."
                                className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Showing <span className="text-slate-800">{filtered.length}</span> of <span className="text-slate-800">{labels.length}</span>
                            </div>
                            <ViewToggle value={viewMode} onChange={setViewMode} className="shrink-0" />
                        </div>
                    </div>

                    {viewMode === 'board' && (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {isLoading ? (
                                <div className="col-span-full rounded-3xl border border-white/80 bg-white p-10 shadow-sm shadow-purple-100/60">
                                    <GreetoLoader label="Loading labels..." sublabel="Fetching contact groups" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="col-span-full rounded-3xl border border-dashed border-violet-200 bg-white">
                                    <WorkspaceEmptyState
                                        title="Create your first contact group"
                                        description="Use groups to organize contacts for campaigns, broadcasts, and follow-up journeys."
                                        primaryLabel="Create group"
                                        onPrimary={() => setShowModal(true)}
                                        secondaryLabel="Open contacts"
                                        onSecondary={() => onNavigate?.('contacts')}
                                    />
                                </div>
                            ) : filtered.map(label => (
                                <div key={label.id} className="group rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-sm shadow-purple-100/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-100 hover:shadow-xl hover:shadow-purple-100">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-fuchsia-50 transition group-hover:scale-105">
                                                <Tag className="text-purple-600" size={20} />
                                            </div>
                                            <div>
                                                <p className="text-base font-semibold text-slate-950">{label.name}</p>
                                                <p className="text-xs font-semibold text-slate-400">Audience label</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-5 rounded-2xl border border-purple-50 bg-purple-50/50 p-4">
                                        <p className="text-2xl font-bold text-slate-950">{label.assigned_count || 0}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Contacts</p>
                                    </div>
                                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                                        <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => openView(label)}>
                                            <Eye size={13} /> View
                                        </Button>
                                        <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => openEdit(label)}>
                                            <UserPlus size={13} /> Add Contacts
                                        </Button>
                                        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(label.id)}>
                                            <Trash2 size={15} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table */}
                    {viewMode === 'table' && <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-sm shadow-purple-100/60">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-purple-50/70 border-b border-purple-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                                <tr>
                                    <th className="px-6 py-4">Group Name</th>
                                    <th className="px-6 py-4">Total Contacts</th>
                                    <th className="px-6 py-4">Created At</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                                            <GreetoLoader label="Loading labels..." sublabel="Fetching contact groups" />
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan="4" className="p-0"><WorkspaceEmptyState title="No contact groups yet" description="Create a group, then attach contacts whenever you are ready." primaryLabel="Create group" onPrimary={() => setShowModal(true)} secondaryLabel="Open contacts" onSecondary={() => onNavigate?.('contacts')} /></td></tr>
                                ) : filtered.map(label => (
                                    <tr key={label.id} className="hover:bg-purple-50/40 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 flex items-center justify-center shrink-0">
                                                    <Tag className="text-purple-500" size={18} />
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors">{label.name}</span>
                                                    <p className="text-xs text-slate-400">Audience label</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Users size={15} className="text-slate-400" />
                                                <span className="font-medium">{label.assigned_count}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(label.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => openView(label)}>
                                                    <Eye size={13} /> View
                                                </Button>
                                                <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => openEdit(label)}>
                                                    <UserPlus size={13} /> Add Contacts
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                                    onClick={() => handleDelete(label.id)}
                                                    title="Delete Group"
                                                >
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>}

                    </div>
                </div>
            </div>

            {/* Modals */}
            <GroupModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                editLabel={editLabel}
                onSuccess={handleSuccess}
            />
            <ViewContactsModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                label={viewLabel}
            />
        </div>
    );
}
