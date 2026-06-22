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
  id?: number;
  clientId: string;
  type: SyncItemType;
  data: Record<string, unknown>;
  syncStatus: SyncStatus;
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  createdAt: number;
}

export interface CachedProfile {
  userId: string;
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

export interface CachedTimelineEntry {
  id: string;
  patientId: string;
  type: 'consultation' | 'condition' | 'medication' | 'vital' | 'document';
  title: string;
  subtitle: string;
  timestamp: string;
  meta: Record<string, unknown>;
  cachedAt: number;
}

// Doctor's patient list - cached so a doctor can search their own patients
// by name or blood group even with zero connectivity (FR - offline search).
export interface CachedPatientListEntry {
  patientId: string;       // primary key
  name: string;
  email: string;
  bloodGroup?: string;
  linkStatus: 'ACTIVE';
  cachedAt: number;
}

// ── Database ─────────────────────────────────────────────────────────────────

class ContinuumDB extends Dexie {
  sync_queue!: Table<SyncQueueItem>;
  cached_profile!: Table<CachedProfile>;
  cached_timeline!: Table<CachedTimelineEntry>;
  cached_patient_list!: Table<CachedPatientListEntry>;

  constructor() {
    super('continuum_db');

    this.version(1).stores({
      sync_queue:     '++id, clientId, type, syncStatus, createdAt',
      cached_profile: 'userId',
    });

    this.version(2).stores({
      sync_queue:      '++id, clientId, type, syncStatus, createdAt',
      cached_profile:  'userId',
      cached_timeline: 'id, patientId, type, timestamp',
    });

    // v3 - adds offline patient search cache for doctors
    this.version(3).stores({
      sync_queue:           '++id, clientId, type, syncStatus, createdAt',
      cached_profile:       'userId',
      cached_timeline:      'id, patientId, type, timestamp',
      cached_patient_list:  'patientId, name, bloodGroup',
    });
  }
}

export const db = new ContinuumDB();

// ── Timeline cache helpers ────────────────────────────────────────────────────

export async function cacheTimeline(
  patientId: string,
  entries: Omit<CachedTimelineEntry, 'patientId' | 'cachedAt'>[]
): Promise<void> {
  await db.cached_timeline.where('patientId').equals(patientId).delete();
  await db.cached_timeline.bulkPut(
    entries.map((e) => ({ ...e, patientId, cachedAt: Date.now() }))
  );
}

export async function getCachedTimeline(patientId: string): Promise<CachedTimelineEntry[]> {
  return db.cached_timeline.where('patientId').equals(patientId).reverse().sortBy('timestamp');
}

// ── Patient list cache helpers (doctor-side offline search) ──────────────────

export async function cachePatientList(
  patients: Omit<CachedPatientListEntry, 'cachedAt' | 'linkStatus'>[]
): Promise<void> {
  await db.cached_patient_list.clear();
  await db.cached_patient_list.bulkPut(
    patients.map((p) => ({ ...p, linkStatus: 'ACTIVE' as const, cachedAt: Date.now() }))
  );
}

export async function searchCachedPatients(query: string): Promise<CachedPatientListEntry[]> {
  if (!query.trim()) return db.cached_patient_list.toArray();

  const lower = query.toLowerCase();
  const all = await db.cached_patient_list.toArray();

  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.bloodGroup?.toLowerCase() === lower ||
      p.email.toLowerCase().includes(lower)
  );
}
