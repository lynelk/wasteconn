/**
 * useSyncManager — React hook that listens for online/offline events and
 * automatically syncs pending IndexedDB records to the backend.
 */
import { useEffect, useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import {
  getPendingWBTransactions,
  markWBTransactionSynced,
  clearSyncedWBTransactions,
  getPendingActions,
  markActionSynced,
} from '@/lib/offlineDB';

export function useSyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const countPending = useCallback(async () => {
    try {
      const [wbt, actions] = await Promise.all([getPendingWBTransactions(), getPendingActions()]);
      setPendingCount(wbt.length + actions.length);
    } catch (err) {
      logger.warn('sync.countPending.error', { message: err?.message });
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    setSyncError(null);
    try {
      // 1. Sync waste bank transactions
      const pendingWBT = await getPendingWBTransactions();
      for (const rec of pendingWBT) {
        const { local_id, synced: _synced, created_at: _ca, ...payload } = rec;
        const txNum = `WB-${payload.transaction_type?.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        await base44.entities.WasteBankTransaction.create({ ...payload, transaction_number: txNum });
        await markWBTransactionSynced(local_id);
      }
      await clearSyncedWBTransactions();

      // 2. Sync generic action queue (pickup status updates, incident reports, etc.)
      const pendingActions = await getPendingActions();
      for (const action of pendingActions) {
        if (action.entity === 'PickupRequest' && action.action === 'update') {
          await base44.entities.PickupRequest.update(action.payload.id, action.payload.data);
        } else if (action.entity === 'PickupRequest' && action.action === 'create') {
          await base44.entities.PickupRequest.create(action.payload);
        } else if (action.entity === 'Ticket' && action.action === 'create') {
          await base44.entities.Ticket.create(action.payload);
        } else if (action.entity === 'ExceptionQueue' && action.action === 'create') {
          await base44.entities.ExceptionQueue.create(action.payload);
        }
        await markActionSynced(action.local_id);
      }

      setLastSyncAt(new Date());
      await countPending();
    } catch (err) {
      logger.error('sync.syncAll.error', { message: err?.message });
      setSyncError({ message: err?.message || 'Sync failed', timestamp: new Date().toISOString() });
    } finally {
      setSyncing(false);
    }
  }, [countPending]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncAll(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    countPending();
    // Poll pending count every 30s
    const interval = setInterval(countPending, 30000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [syncAll, countPending]);

  return { isOnline, pendingCount, syncing, lastSyncAt, syncNow: syncAll, syncError };
}