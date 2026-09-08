import { useState, useEffect, useCallback } from 'react';
import { syncXoloxContacts, getXoloxSyncStatus } from '../api.js';

export function useSync(onComplete) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

    const fetchSyncStatus = useCallback(async () => {
        try {
            const res = await getXoloxSyncStatus();
            if (res.success && res.status === 'syncing') {
                setIsSyncing(true);
                setSyncProgress({ current: res.processed, total: res.total });
            } else if (res.success && res.status === 'completed') {
                setIsSyncing(false);
                setSyncProgress({ current: 0, total: 0 });
                if (onComplete) onComplete(true);
            } else {
                setIsSyncing(false);
                setSyncProgress({ current: 0, total: 0 });
            }
        } catch (error) {
            console.error('Error fetching sync status:', error);
            setIsSyncing(false);
        }
    }, [onComplete]);

    useEffect(() => {
        let interval;
        if (isSyncing) {
            interval = setInterval(fetchSyncStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [isSyncing, fetchSyncStatus]);

    useEffect(() => {
        fetchSyncStatus();
    }, [fetchSyncStatus]);

    const handleSyncAll = async () => {
        setIsSyncing(true);
        try {
            const res = await syncXoloxContacts();
            if (res.success) {
                fetchSyncStatus();
            }
        } catch (error) {
            console.error('Error initiating sync:', error);
            setIsSyncing(false);
        }
    };

    return {
        isSyncing,
        syncProgress,
        handleSyncAll
    };
}
