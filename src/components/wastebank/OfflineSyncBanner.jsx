/**
 * OfflineSyncBanner — shows pending offline transactions and lets agents sync manually.
 */
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflineSyncBanner({ isOnline, pendingCount, syncing, lastSyncAt, onSync }) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm ${
      !isOnline ? 'bg-yellow-900/40 border border-yellow-700 text-yellow-300'
      : pendingCount > 0 ? 'bg-blue-900/40 border border-blue-700 text-blue-300'
      : 'bg-green-900/40 border border-green-700 text-green-300'
    }`}>
      <div className="flex items-center gap-2">
        {!isOnline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
        <span>
          {!isOnline
            ? `Offline — ${pendingCount} transaction(s) queued`
            : `${pendingCount} pending transaction(s) to sync`}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-blue-300" onClick={onSync} disabled={syncing}>
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      )}
    </div>
  );
}