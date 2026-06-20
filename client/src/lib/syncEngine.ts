import { db, SyncQueueItem } from './offlineDB';
import api from './apiClient';

// Exponential backoff delays in ms
const BACKOFF = [2000, 4000, 8000, 16000, 32000];
const MAX_RETRIES = 5;

// ── Route map — maps item type to Express endpoint ───────────────────────────
const SYNC_ROUTES: Record<string, string> = {
  patient_profile:     '/patients/sync/profile',
  consultation:        '/consultations',
  vitals:              '/vitals',
  followup_completion: '/followups/complete',
  call_recording:      '/calls/recording',
};

// ── Core sync function ────────────────────────────────────────────────────────

export async function syncPendingItems(): Promise<void> {
  const pending = await db.sync_queue
    .where('syncStatus')
    .equals('pending')
    .sortBy('createdAt');

  if (pending.length === 0) return;

  console.log(`🔄 Syncing ${pending.length} pending item(s)...`);

  for (const item of pending) {
    await syncItem(item);
  }
}

async function syncItem(item: SyncQueueItem): Promise<void> {
  const route = SYNC_ROUTES[item.type];
  if (!route) {
    console.warn(`No route mapped for sync type: ${item.type}`);
    return;
  }

  // Mark as syncing
  await db.sync_queue.update(item.id!, {
    syncStatus: 'syncing',
    lastAttemptAt: Date.now(),
  });

  try {
    await api.post(route, item.data);

    // Success — mark synced
    await db.sync_queue.update(item.id!, { syncStatus: 'synced' });
    console.log(`✅ Synced item ${item.clientId} (${item.type})`);
  } catch (error: unknown) {
    const newRetryCount = item.retryCount + 1;
    const axiosError = error as { response?: { status: number; data?: { error?: string } } };

    if (axiosError.response?.status === 409) {
      // Conflict — server has newer version
      await db.sync_queue.update(item.id!, {
        syncStatus: 'failed',
        retryCount: newRetryCount,
        errorMessage: 'Conflict: server has a newer version of this record',
      });
      console.warn(`⚠️ Conflict on item ${item.clientId}`);
      return;
    }

    if (newRetryCount >= MAX_RETRIES) {
      await db.sync_queue.update(item.id!, {
        syncStatus: 'failed',
        retryCount: newRetryCount,
        errorMessage: axiosError.response?.data?.error || 'Max retries reached',
      });
      console.error(`❌ Item ${item.clientId} permanently failed after ${MAX_RETRIES} retries`);
      return;
    }

    // Schedule retry with backoff
    const delay = BACKOFF[newRetryCount - 1] || 32000;
    await db.sync_queue.update(item.id!, {
      syncStatus: 'pending',
      retryCount: newRetryCount,
      errorMessage: axiosError.response?.data?.error || 'Network error',
    });

    console.warn(
      `⚠️ Item ${item.clientId} failed (attempt ${newRetryCount}). Retrying in ${delay / 1000}s`
    );

    setTimeout(async () => {
      const updated = await db.sync_queue.get(item.id!);
      if (updated?.syncStatus === 'pending') {
        await syncItem({ ...item, retryCount: newRetryCount });
      }
    }, delay);
  }
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

export async function queueItem(
  type: SyncQueueItem['type'],
  data: Record<string, unknown>
): Promise<void> {
  await db.sync_queue.add({
    clientId: crypto.randomUUID(),
    type,
    data,
    syncStatus: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  });
}

export async function getSyncStats(): Promise<{
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
}> {
  const pending = await db.sync_queue.where('syncStatus').equals('pending').count();
  const failed = await db.sync_queue.where('syncStatus').equals('failed').count();
  const lastSynced = await db.sync_queue
    .where('syncStatus')
    .equals('synced')
    .reverse()
    .first();

  return {
    pending,
    failed,
    lastSyncedAt: lastSynced?.lastAttemptAt ?? null,
  };
}

// ── Auto-sync on online event ─────────────────────────────────────────────────

export function initSyncEngine(): () => void {
  const handleOnline = () => {
    console.log('🌐 Back online — starting sync...');
    syncPendingItems();
  };

  window.addEventListener('online', handleOnline);

  // Also sync immediately if already online on init
  if (navigator.onLine) {
    syncPendingItems();
  }

  // Cleanup
  return () => window.removeEventListener('online', handleOnline);
}
