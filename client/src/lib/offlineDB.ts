import Dexie, { type Table } from 'dexie';

// ── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type SyncItemType =
  | 'patient_profile'
  | 'consultation'
  | 'document'
  | 'vitals'
  | 'followup_completion'
  | 'call_recording';

export interface SyncQueueItem {
  id?: number;            // auto-increment
  clientId: string;       // UUID generated client-side
  type: SyncItemType;
  data: Record<string, unknown>;
  syncStatus: SyncStatus;
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  createdAt: number;
}

export interface CachedProfile {
  userId: string;         // primary key
  name: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR';
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  knownAllergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  updatedAt: string;
}

// ── Database ─────────────────────────────────────────────────────────────────

class ContinuumDB extends Dexie {
  sync_queue!: Table<SyncQueueItem>;
  cached_profile!: Table<CachedProfile>;

  constructor() {
    super('continuum_db');
    this.version(1).stores({
      sync_queue:     '++id, clientId, type, syncStatus, createdAt',
      cached_profile: 'userId',
    });
  }
}

export const db = new ContinuumDB();
