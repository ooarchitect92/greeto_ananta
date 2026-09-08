import { useState, useEffect, useCallback } from 'react';
import { getContacts, deleteContact, getContactChannels, putContact, addContact } from '../api.js';
import { confirmAction } from '@/components/ui/confirmAction';

export function useContacts() {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);
    const [filters, setFilters] = useState({
        leadStage: '',
        leadStatus: '',
        course: '',
        assignedTo: ''
    });
    const [channels, setChannels] = useState([]);

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {
                page,
                limit: rowsPerPage,
                search: searchTerm,
                ...filters
            };
            const res = await getContacts(params);
            if (res.success) {
                setContacts(res.contacts);
                setTotalPages(res.totalPages);
                setTotalContacts(res.total);
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, rowsPerPage, searchTerm, filters]);

    const fetchChannels = useCallback(async () => {
        try {
            const res = await getContactChannels();
            if (res.success) {
                setChannels(res.channels);
            }
        } catch (error) {
            console.error('Error fetching channels:', error);
        }
    }, []);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const handleRowsPerPageChange = (newRows) => {
        setRowsPerPage(newRows);
        setPage(1);
    };

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
        setPage(1);
    };

    const handleDeleteContact = async (contact) => {
        if (!(await confirmAction({
            title: 'Delete contact?',
            message: `Are you sure you want to delete ${contact.display_name || 'this contact'}?`,
            confirmLabel: 'Delete contact',
            tone: 'danger',
        }))) return;
        try {
            const res = await deleteContact(contact.id);
            if (res.success) {
                fetchContacts();
            }
        } catch (error) {
            console.error('Error deleting contact:', error);
        }
    };

    const handleContactAdded = () => {
        fetchContacts();
    };

    const handleContactUpdated = () => {
        fetchContacts();
    };

    return {
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
        refresh: fetchContacts
    };
}
