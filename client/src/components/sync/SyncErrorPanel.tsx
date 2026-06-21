import React, { useEffect, useState } from 'react';
import { db, SyncQueueItem } from '../../lib/offlineDB';
import { syncPendingItems } from '../../lib/syncEngine';

const TYPE_LABEL: Record<string, string> = {
  patient_profile: 'Profile update',
  consultation: 'Consultation',
  document: 'Document upload',
  vitals: 'Vitals reading',
  followup_completion: 'Follow-up completion',
  call_recording: 'Call recording',
};

export const SyncErrorPanel: React.FC = () => {
  const [failedItems, setFailedItems] = useState<SyncQueueItem[]>([]);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const items = await db.sync_queue.where('syncStatus').equals('failed').toArray();
    setFailedItems(items);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (item: SyncQueueItem) => {
    setRetrying(item.id!);
    await db.sync_queue.update(item.id!, {
      syncStatus: 'pending',
      retryCount: 0,
      errorMessage: undefined,
    });
    await syncPendingItems();
    await refresh();
    setRetrying(null);
  };

  const handleDiscard = async (item: SyncQueueItem) => {
    if (!confirm('Discard this item permanently? This data will be lost.')) return;
    await db.sync_queue.delete(item.id!);
    await refresh();
  };

  if (failedItems.length === 0) return null;

  return (
    <div className="fixed bottom-12 left-0 right-0 z-40 px-4">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => setOpen(!open)}
          className="w-full glass-elevated rounded-t-xl px-4 py-2.5 flex items-center justify-between text-[12px] font-medium"
          style={{ color: '#991B1B' }}
        >
          <span>⚠ {failedItems.length} item{failedItems.length > 1 ? 's' : ''} failed to sync</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="glass-elevated rounded-b-xl px-3 pb-3 max-h-64 overflow-y-auto space-y-2">
            {failedItems.map((item) => (
              <div key={item.id} className="rounded-md p-3"
                style={{ background: 'rgba(239,68,68,0.10)', border: '0.5px solid rgba(239,68,68,0.30)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium text-[#991B1B]">
                    {TYPE_LABEL[item.type] || item.type}
                  </span>
                  <span className="text-[10px] text-[#78716C]">
                    {item.retryCount} attempt{item.retryCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {item.errorMessage && (
                  <div className="text-[11px] text-[#78716C] mb-2">{item.errorMessage}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRetry(item)}
                    disabled={retrying === item.id}
                    className="text-[11px] font-medium px-3 py-1 rounded-sm disabled:opacity-50"
                    style={{ background: 'rgba(14,165,233,0.20)', border: '0.5px solid rgba(14,165,233,0.40)', color: '#0284C7' }}
                  >
                    {retrying === item.id ? 'Retrying…' : 'Retry now'}
                  </button>
                  <button
                    onClick={() => handleDiscard(item)}
                    className="text-[11px] text-[#78716C] px-3 py-1"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
