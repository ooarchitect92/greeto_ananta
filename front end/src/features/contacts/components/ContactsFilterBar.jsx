import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { LEAD_STAGES, LEAD_STATUSES } from '../utils/constants.jsx';

export function ContactsFilterBar({ 
    search, setSearch, 
    filters, onFilterChange, 
    onClearFilters 
}) {
    const hasActiveFilters = search || Object.values(filters).some(v => v !== '');

    return (
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Search name, phone, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value={filters.leadStage}
                    onChange={(e) => onFilterChange('leadStage', e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                >
                    <option value="">All Stages</option>
                    {LEAD_STAGES.map(stage => (
                        <option key={stage} value={stage}>
                            {stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                    ))}
                </select>

                <select
                    value={filters.leadStatus}
                    onChange={(e) => onFilterChange('leadStatus', e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                >
                    <option value="">All Statuses</option>
                    {LEAD_STATUSES.map(status => (
                        <option key={status} value={status}>
                            {status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                    ))}
                </select>

                {hasActiveFilters && (
                    <button
                        onClick={onClearFilters}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        <X size={14} />
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}
