import { db, SyncQueueItem } from './offlineDB';
import api from './apiClient';

const BACKOFF = [2000, 4000, 8000, 16000, 32000];
const MAX_RETRIES = 5;

const SYNC_ROUTES: Record<string, string> = {
  patient_profile:     '/patients/sync/profile',
  consultation:        '/consultations',
  vitals:              '/vitals',
  document:            '/documents/me',
  followup_completion: '/followups/complete',
  call_recording:      '/calls/recording',
};

// Simple pub-sub so UI components can react to conflicts without polling
type ConflictListener = (item: SyncQueueItem) => void;
const conflictListeners: ConflictListener[] = [];
export function onSyncConflict(listener: ConflictListener): () => void {
  conflictListeners.push(listener);
  return () => {
    const i = conflictListeners.indexOf(listener);
    if (i >= 0) conflictListeners.splice(i, 1);
  };
}

export async function syncPendingItems(): Promise<void> {
  const pending = await db.sync_queue.where('syncStatus').equals('pending').sortBy('createdAt');
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

  await db.sync_queue.update(item.id!, { syncStatus: 'syncing', lastAttemptAt: Date.now() });

  try {
    if (item.type === 'call_recording') {
      // Reconstruct the blob from base64 and upload as multipart
      const { callId, recordingBase64 } = item.data as { callId: string; recordingBase64: string };
      const blob = await base64ToBlob(recordingBase64);
      const formData = new FormData();
      formData.append('recording', blob, 'call-recording.webm');
      await api.post(`/calls/${callId}/recording`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (item.type === 'consultation') {
      const { doctorId, priority, symptomsChecklist, patientNotes, audioBase64 } = item.data as {
        doctorId: string;
        priority: string;
        symptomsChecklist: string;
        patientNotes: string;
        audioBase64?: string;
      };
      const formData = new FormData();
      formData.append('doctorId', doctorId);
      formData.append('priority', priority);
      formData.append('symptomsChecklist', symptomsChecklist);
      formData.append('patientNotes', patientNotes);
      if (audioBase64) {
        const blob = await base64ToBlob(audioBase64);
        formData.append('audio', blob, 'symptoms.webm');
      }
      await api.post(route, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (item.type === 'document') {
      const { fileBase64, fileName, documentType } = item.data as {
        fileBase64: string;
        fileName: string;
        documentType: string;
      };
      const blob = await base64ToBlob(fileBase64);
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('documentType', documentType);
      await api.post(route, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else {
      await api.post(route, item.data);
    }

    await db.sync_queue.update(item.id!, { syncStatus: 'synced' });
    console.log(`Synced item ${item.clientId} (${item.type})`);
  } catch (error: unknown) {
    const newRetryCount = item.retryCount + 1;
    const axiosError = error as { response?: { status: number; data?: { error?: string } } };

    if (axiosError.response?.status === 409) {
      // Conflict — server has a newer version. Mark failed immediately,
      // don't retry automatically (retrying won't help — the data is stale).
      const updated: SyncQueueItem = {
        ...item,
        syncStatus: 'failed',
        retryCount: newRetryCount,
        errorMessage: 'This record was updated elsewhere. Your local version was not saved.',
      };
      await db.sync_queue.update(item.id!, updated);
      conflictListeners.forEach((fn) => fn(updated));
      console.warn(`Conflict on item ${item.clientId}`);
      return;
    }

    if (newRetryCount >= MAX_RETRIES) {
      await db.sync_queue.update(item.id!, {
        syncStatus: 'failed',
        retryCount: newRetryCount,
        errorMessage: axiosError.response?.data?.error || 'Failed after multiple attempts. Check your connection.',
      });
      console.error(`Item ${item.clientId} permanently failed after ${MAX_RETRIES} retries`);
      return;
    }

    const delay = BACKOFF[newRetryCount - 1] || 32000;
    await db.sync_queue.update(item.id!, {
      syncStatus: 'pending',
      retryCount: newRetryCount,
      errorMessage: axiosError.response?.data?.error || 'Network error — will retry automatically',
    });

    console.warn(`Item ${item.clientId} failed (attempt ${newRetryCount}). Retrying in ${delay / 1000}s`);

    setTimeout(async () => {
      const updated = await db.sync_queue.get(item.id!);
      if (updated?.syncStatus === 'pending') {
        await syncItem({ ...item, retryCount: newRetryCount });
      }
    }, delay);
  }
}

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
  const lastSynced = await db.sync_queue.where('syncStatus').equals('synced').reverse().first();

  return {
    pending,
    failed,
    lastSyncedAt: lastSynced?.lastAttemptAt ?? null,
  };
}

export function initSyncEngine(): () => void {
  const handleOnline = () => {
    console.log('🌐 Back online — starting sync...');
    syncPendingItems();
  };

  window.addEventListener('online', handleOnline);
  if (navigator.onLine) syncPendingItems();

  return () => window.removeEventListener('online', handleOnline);
}

async function base64ToBlob(base64: string): Promise<Blob> {
  const res = await fetch(base64);
  return res.blob();
}
