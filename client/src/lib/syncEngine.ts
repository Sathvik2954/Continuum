import db, { type SyncQueueItem } from './offlineDB';
import apiClient from './apiClient';

// Helper to generate UUIDs client-side
export function generateUUID(): string {
  return crypto.randomUUID();
}

type SyncStatusListener = (status: {
  pendingCount: number;
  syncing: boolean;
  lastSyncedAt?: number;
  hasErrors: boolean;
}) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncStatusListener> = new Set();
  private lastSyncedAt?: number;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.triggerSync());
      window.addEventListener('offline', () => this.notifyStatus());
    }
  }

  // Register listener for UI status updates
  subscribe(listener: SyncStatusListener) {
    this.listeners.add(listener);
    this.notifyStatus();
    return () => this.listeners.delete(listener);
  }

  private async notifyStatus() {
    try {
      const pendingCount = await db.sync_queue.where('syncStatus').anyOf(['pending', 'syncing']).count();
      const failedCount = await db.sync_queue.where('syncStatus').equals('failed').count();
      this.listeners.forEach((listener) =>
        listener({
          pendingCount,
          syncing: this.isSyncing,
          lastSyncedAt: this.lastSyncedAt,
          hasErrors: failedCount > 0,
        })
      );
    } catch (err) {
      console.error('Failed to notify status:', err);
    }
  }

  // Queue a new item for background synchronization
  async queueItem(
    type: SyncQueueItem['type'],
    data: any,
    blobField?: string,
    blob?: Blob
  ): Promise<string> {
    const id = generateUUID();
    
    // Add client-side timestamp if missing
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }
    // Also store unique ID in record itself
    data.id = id;

    // Save blob separately in the blobs table if exists
    if (blob && blobField) {
      await db.blobs.put({ id, type: blobField.includes('Audio') ? 'audio' : 'image', blob });
    }

    await db.sync_queue.put({
      id,
      type,
      data,
      blobField,
      syncStatus: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    });

    this.notifyStatus();
    
    // Fire sync attempt immediately in background (non-blocking)
    this.triggerSync();

    return id;
  }

  // Trigger synchronization execution
  async triggerSync(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notifyStatus();
      return;
    }

    this.isSyncing = true;
    this.notifyStatus();

    try {
      // Find items in sync queue that are pending or need retrying
      const items = await db.sync_queue
        .where('syncStatus')
        .anyOf(['pending', 'syncing'])
        .toArray();

      // Sort chronologically (oldest first)
      items.sort((a, b) => a.createdAt - b.createdAt);

      for (const item of items) {
        await this.syncQueueItem(item);
      }
    } catch (err) {
      console.error('Sync process encountered an error:', err);
    } finally {
      this.isSyncing = false;
      this.lastSyncedAt = Date.now();
      this.notifyStatus();
    }
  }

  private async syncQueueItem(item: SyncQueueItem): Promise<void> {
    try {
      // 1. Mark item as syncing
      await db.sync_queue.update(item.id!, { syncStatus: 'syncing', lastAttemptAt: Date.now() });
      this.notifyStatus();

      // 2. Upload blobs if present
      let finalData = { ...item.data };
      if (item.blobField) {
        const storedBlob = await db.blobs.get(item.id!);
        if (storedBlob) {
          const formData = new FormData();
          formData.append('file', storedBlob.blob, `upload_${item.id!}.${storedBlob.type === 'audio' ? 'webm' : 'jpg'}`);
          formData.append('type', item.type);

          const uploadResponse = await apiClient.post('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          // Store returned file URL in the payload
          finalData[item.blobField] = uploadResponse.data.url;
        }
      }

      // 3. Post data payload to Server Sync Router
      const response = await apiClient.post('/sync', {
        id: item.id,
        type: item.type,
        data: finalData,
      });

      // 4. On success, remove from queues and caches
      await db.sync_queue.delete(item.id!);
      await db.blobs.delete(item.id!);

      // Update local IndexedDB caches with the latest state returned by the server
      await this.updateLocalCache(item.type, response.data.record);
    } catch (error: any) {
      console.error(`Sync failed for item ${item.id!}:`, error);

      if (error.response && error.response.status === 409) {
        // HTTP 409 Conflict: Last-write-wins reject
        await db.sync_queue.update(item.id!, {
          syncStatus: 'failed',
          errorMessage: 'Conflict: This record was updated elsewhere.',
        });

        // Trigger user notification
        this.dispatchConflictNotification(item.type, error.response.data.serverVersion);

        // Fetch latest version to overwrite local cache
        if (error.response.data.serverVersion) {
          await this.updateLocalCache(item.type, error.response.data.serverVersion);
        }
      } else {
        // Network or server temporary errors -> retry with backoff
        const newRetryCount = item.retryCount + 1;
        if (newRetryCount >= 5) {
          await db.sync_queue.update(item.id!, {
            syncStatus: 'failed',
            errorMessage: error.message || 'Server error, exhausted retries.',
            retryCount: newRetryCount,
          });
        } else {
          await db.sync_queue.update(item.id!, {
            syncStatus: 'pending', // Reset to try again next time
            retryCount: newRetryCount,
          });
          // Wait according to backoff: 2s, 4s, 8s, 16s, 32s
          const waitMs = Math.pow(2, newRetryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }
  }

  // Update relevant Dexie cache table after a successful server sync
  private async updateLocalCache(type: SyncQueueItem['type'], record: any) {
    if (!record) return;
    
    switch (type) {
      case 'patient_profile':
        await db.cached_profile.put(record);
        break;
      case 'consultation':
      case 'call_recording':
        await db.cached_consultations.put(record);
        break;
      case 'vitals':
        await db.cached_vitals.put(record);
        break;
      case 'followup_completion':
        await db.cached_followups.put(record);
        break;
    }
  }

  // Dispatches a global custom event for showing non-blocking toast conflict alerts
  private dispatchConflictNotification(type: string, serverVersion: any) {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('continuum-sync-conflict', {
        detail: { type, serverVersion },
      });
      window.dispatchEvent(event);
    }
  }

  // Manually retry a failed item in the queue
  async retryFailedItem(id: string) {
    const item = await db.sync_queue.get(id);
    if (item) {
      await db.sync_queue.update(id, { syncStatus: 'pending', retryCount: 0 });
      this.notifyStatus();
      this.triggerSync();
    }
  }

  // Clear a failed item from the queue entirely (discarding local changes)
  async discardFailedItem(id: string) {
    await db.sync_queue.delete(id);
    await db.blobs.delete(id);
    this.notifyStatus();
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
