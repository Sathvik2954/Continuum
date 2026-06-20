import React, { useEffect, useState } from 'react';
import { getSyncStats, syncPendingItems } from '../../lib/syncEngine';

interface SyncStats {
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
}

export const SyncStatusWidget: React.FC = () => {
  const [stats, setStats] = useState<SyncStats>({ pending: 0, failed: 0, lastSyncedAt: null });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    const s = await getSyncStats();
    setStats(s);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);

    const handleOnline = () => { setIsOnline(true); refresh(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    await syncPendingItems();
    await refresh();
    setSyncing(false);
  };

  const formatTime = (ts: number | null): string => {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // Determine state
  const state = !isOnline
    ? 'offline'
    : stats.failed > 0
    ? 'failed'
    : stats.pending > 0
    ? 'pending'
    : 'synced';

  const config = {
    synced:  { dot: 'bg-success animate-pulse-slow', text: `Synced · ${formatTime(stats.lastSyncedAt)}`, textColor: 'text-[#065F46]' },
    pending: { dot: 'bg-high animate-pulse-fast',   text: `${stats.pending} item${stats.pending > 1 ? 's' : ''} pending`, textColor: 'text-[#78350F]' },
    failed:  { dot: 'bg-urgent',                    text: `${stats.failed} sync failed`, textColor: 'text-[#991B1B]' },
    offline: { dot: 'bg-[#A8A29E]',                         text: 'Offline · data saved locally', textColor: 'text-[#78716C]' },
  }[state];

  return (
    <div className="glass-navbar fixed bottom-0 left-0 right-0 h-11 flex items-center px-5 gap-3 z-50">
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />

      {/* Status text */}
      <span className={`text-xs ${config.textColor} flex-1`}>{config.text}</span>

      {/* Pending progress bar */}
      {state === 'pending' && (
        <div className="w-24 h-1 rounded-full bg-[rgba(245,158,11,0.2)] overflow-hidden">
          <div
            className="h-full bg-high rounded-full transition-all duration-300"
            style={{ width: `${Math.min((stats.pending / 10) * 100, 100)}%` }}
          />
        </div>
      )}

      {/* Retry button */}
      {state === 'failed' && isOnline && (
        <button
          onClick={handleManualSync}
          className="text-xs font-medium text-sky-600 glass-subtle px-3 py-1 rounded-sm"
        >
          Retry
        </button>
      )}

      {/* Manual sync */}
      {state === 'synced' && isOnline && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="text-xs text-[#78716C] disabled:opacity-40"
        >
          {syncing ? 'Syncing…' : '↻'}
        </button>
      )}
    </div>
  );
};
