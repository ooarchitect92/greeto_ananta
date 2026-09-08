import React from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';

export function ContactsHeader({ totalContacts, isSyncing, syncProgress, onSync, onAddContact }) {
    return (
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
                <p className="text-sm text-slate-500">{totalContacts} total contacts</p>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                    <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing 
                        ? `Syncing (${syncProgress.current}/${syncProgress.total})` 
                        : 'Sync XOLOX Contacts'}
                </button>
                <button
                    onClick={onAddContact}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-all shadow-sm"
                >
                    <UserPlus size={16} />
                    Add Contact
                </button>
            </div>
        </div>
    );
}
