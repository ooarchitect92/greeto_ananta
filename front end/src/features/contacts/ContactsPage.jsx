import React, { useState } from 'react';
import { useContacts } from './hooks/useContacts.js';
import { useSync } from './hooks/useSync.js';
import { ContactsHeader } from './components/ContactsHeader.jsx';
import { ContactsFilterBar } from './components/ContactsFilterBar.jsx';
import { ContactsTable } from './components/ContactsTable/ContactsTable.jsx';
import { ContactDetailsDrawer } from './components/ContactDetails/ContactDetailsDrawer.jsx';
import { AddContactModal } from './components/Modals/AddContactModal.jsx';

export default function ContactsPage({ currentUser }) {
    const {
        contacts,
        isLoading,
        searchTerm,
        setSearchTerm,
        page,
        totalPages,
        totalContacts,
        rowsPerPage,
        filters,
        channels,
        handlePageChange,
        handleRowsPerPageChange,
        handleFilterChange,
        handleDeleteContact,
        handleContactAdded,
        handleContactUpdated,
        refresh
    } = useContacts();

    const { isSyncing, syncProgress, handleSyncAll } = useSync(refresh);

    const [selectedContact, setSelectedContact] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const handleSelectContact = (contact) => {
        setSelectedContact(contact);
        setIsDrawerOpen(true);
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        handleFilterChange('leadStage', '');
        handleFilterChange('leadStatus', '');
        handleFilterChange('course', '');
        handleFilterChange('assignedTo', '');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <ContactsHeader 
                totalContacts={totalContacts}
                isSyncing={isSyncing}
                syncProgress={syncProgress}
                onSync={handleSyncAll}
                onAddContact={() => setIsAddModalOpen(true)}
            />

            <ContactsFilterBar 
                search={searchTerm}
                setSearch={setSearchTerm}
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
            />

            <ContactsTable 
                contacts={contacts}
                isLoading={isLoading}
                onSelectContact={handleSelectContact}
                onDeleteContact={handleDeleteContact}
                onEditContact={handleSelectContact}
            />

            {/* Pagination */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                    Showing {Math.min((page - 1) * rowsPerPage + 1, totalContacts)} to {Math.min(page * rowsPerPage, totalContacts)} of {totalContacts} contacts
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm font-medium px-4 py-1 bg-slate-100 rounded-md">
                        {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages}
                        className="px-3 py-1 text-sm border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>

            <ContactDetailsDrawer 
                contact={selectedContact}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onUpdate={handleContactUpdated}
                onDelete={handleDeleteContact}
            />

            <AddContactModal 
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                channels={channels}
                onSuccess={handleContactAdded}
            />
        </div>
    );
}
