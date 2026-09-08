import React from 'react';
import { User, Mail, Phone, Calendar, MoreVertical, Trash2, ExternalLink } from 'lucide-react';
import { ChannelIcon } from '../../utils/constants.jsx';
import GreetoLoader from '../../../../components/ui/GreetoLoader.jsx';

function ContactRow({ contact, onSelect, onDelete, onEdit }) {
    return (
        <tr className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onSelect(contact)}>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                        {contact.display_name?.charAt(0) || <User size={20} />}
                    </div>
                    <div className="ml-4">
                        <div className="text-sm font-semibold text-slate-900">{contact.display_name || 'Unnamed Contact'}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="capitalize">{contact.lead_stage?.replace('_', ' ') || 'New'}</span>
                            <span>•</span>
                            <span className="capitalize">{contact.lead_status || 'New'}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                    {contact.phone && (
                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            {contact.phone}
                        </div>
                    )}
                    {contact.email && (
                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                            <Mail size={12} className="text-slate-400" />
                            {contact.email}
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-wrap gap-1">
                    {contact.channels?.map(channel => (
                        <div key={channel.id} className="p-1.5 bg-white border border-slate-200 rounded-md shadow-sm" title={channel.name}>
                            <ChannelIcon type={channel.type} name={channel.name} size={14} />
                        </div>
                    ))}
                    {(!contact.channels || contact.channels.length === 0) && (
                        <span className="text-xs text-slate-400 italic">No channels</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : 'N/A'}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(contact);
                        }}
                        className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                    >
                        <ExternalLink size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(contact);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    );
}

export function ContactsTable({ contacts, isLoading, onSelectContact, onDeleteContact, onEditContact }) {
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <GreetoLoader label="Loading contacts..." sublabel="Fetching contact registry" />
            </div>
        );
    }

    if (contacts.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <User size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No contacts found</h3>
                <p className="text-slate-500 max-w-sm mt-1">
                    We couldn't find any contacts matching your criteria. Try adjusting your filters or search.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-white">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Info</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Channels</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Created At</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                    {contacts.map(contact => (
                        <ContactRow 
                            key={contact.id} 
                            contact={contact} 
                            onSelect={onSelectContact} 
                            onDelete={onDeleteContact}
                            onEdit={onEditContact}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
