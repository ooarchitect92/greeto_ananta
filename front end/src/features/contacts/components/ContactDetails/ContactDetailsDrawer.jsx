import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, Tag, Calendar, Save, Trash2, ExternalLink } from 'lucide-react';
import { putContact } from '../../api.js';
import { LEAD_STAGES, LEAD_STATUSES } from '../../utils/constants.jsx';

export function ContactDetailsDrawer({ contact, isOpen, onClose, onUpdate, onDelete }) {
    const [formData, setFormData] = useState(contact || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (contact) {
            setFormData(contact);
        }
    }, [contact]);

    if (!isOpen || !contact) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await putContact(contact.id, formData);
            if (res.success) {
                onUpdate(res.contact);
                onClose();
            }
        } catch (error) {
            console.error('Error saving contact:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200">
                <div className="h-full flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <h2 className="text-lg font-bold text-slate-900">Contact Details</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="flex flex-col items-center pb-6 border-b border-slate-100">
                            <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-3xl font-bold border-4 border-white shadow-md">
                                {formData.display_name?.charAt(0) || <User size={40} />}
                            </div>
                            <h3 className="mt-4 text-xl font-bold text-slate-900">{formData.display_name || 'Unnamed Contact'}</h3>
                            <p className="text-sm text-slate-500">{formData.phone}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lead Stage</label>
                                <select
                                    value={formData.lead_stage || ''}
                                    onChange={(e) => setFormData({ ...formData, lead_stage: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                                >
                                    <option value="">Select Stage</option>
                                    {LEAD_STAGES.map(stage => (
                                        <option key={stage} value={stage}>
                                            {stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lead Status</label>
                                <select
                                    value={formData.lead_status || ''}
                                    onChange={(e) => setFormData({ ...formData, lead_status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                                >
                                    <option value="">Select Status</option>
                                    {LEAD_STATUSES.map(status => (
                                        <option key={status} value={status}>
                                            {status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-4">
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <Phone size={18} className="text-slate-400" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Phone</p>
                                        <p className="text-sm text-slate-700">{formData.phone || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <Mail size={18} className="text-slate-400" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                                        <p className="text-sm text-slate-700">{formData.email || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-all shadow-sm"
                        >
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            onClick={() => onDelete(contact)}
                            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-slate-200"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
