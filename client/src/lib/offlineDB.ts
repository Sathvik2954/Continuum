import Dexie, { type Table } from 'dexie';

// Define TS Interfaces for Offline Stores

export interface SyncQueueItem {
  id?: string; // Client-generated UUID (string) or auto-incremented id
  type: 'consultation' | 'document' | 'vitals' | 'followup_completion' | 'patient_profile' | 'call_recording';
  data: any; // Raw JSON payload
  blobField?: string;
  blob?: Blob;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  createdAt: number;
}

export interface CachedProfile {
  patientId: string;
  userId: string;
  name: string;
  email: string;
  dateOfBirth?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
  knownAllergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  phone?: string;
  updatedAt: string;
}

export interface CachedTimeline {
  patientId: string;
  items: any[]; // Combined array of timeline events
  updatedAt: number;
}

export interface CachedConsultation {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  type: 'ASYNC' | 'LIVE_CALL';
  initiatedBy: 'PATIENT' | 'DOCTOR';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: string;
  checkinTopic?: string;
  symptomsChecklist?: any;
  patientNotes?: string;
  symptomAudioUrl?: string;
  doctorResponseAudioUrl?: string;
  doctorNotes?: string;
  callScheduledAt?: string;
  callRecordingUrl?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedCondition {
  id: string;
  patientId: string;
  conditionName: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  diagnosedOn: string;
  status: 'ACTIVE' | 'RESOLVED';
  notes?: string;
  addedByDoctorName?: string;
  createdAt: string;
}

export interface CachedMedication {
  id: string;
  patientId: string;
  consultationId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
  startDate: string;
  prescribedByDoctorName?: string;
  isExpired: boolean;
  createdAt: string;
}

export interface CachedFollowup {
  id: string;
  patientId: string;
  consultationId: string;
  doctorId: string;
  doctorName?: string;
  scheduledDate: string;
  type: 'IN_PERSON' | 'AUDIO_CHECKIN' | 'VITALS_CHECK' | 'LIVE_CALL';
  notes?: string;
  completed: boolean;
  completedAt?: string;
  completionNotes?: string;
}

export interface CachedVital {
  id?: number;
  patientId: string;
  recordedAt: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodGlucoseFasting?: number;
  bloodGlucosePostMeal?: number;
  weightKg?: number;
  heartRate?: number;
  notes?: string;
  syncStatus?: 'synced' | 'pending';
}

export interface BlobStoreItem {
  id: string; // key matching the queue item id or temp asset id
  type: 'audio' | 'image';
  blob: Blob;
}

// Dexie Database Class Definition
class ContinuumOfflineDB extends Dexie {
  sync_queue!: Table<SyncQueueItem, string>;
  cached_profile!: Table<CachedProfile, string>;
  cached_timeline!: Table<CachedTimeline, string>;
  cached_consultations!: Table<CachedConsultation, string>;
  cached_conditions!: Table<CachedCondition, string>;
  cached_medications!: Table<CachedMedication, string>;
  cached_followups!: Table<CachedFollowup, string>;
  cached_vitals!: Table<CachedVital, number>;
  blobs!: Table<BlobStoreItem, string>;

  constructor() {
    super('ContinuumV3OfflineDB');
    this.version(1).stores({
      sync_queue: 'id, type, syncStatus, createdAt',
      cached_profile: 'patientId',
      cached_timeline: 'patientId, updatedAt',
      cached_consultations: 'id, patientId, status, updatedAt',
      cached_conditions: 'id, patientId',
      cached_medications: 'id, patientId',
      cached_followups: 'id, patientId, scheduledDate, completed',
      cached_vitals: '++id, patientId, recordedAt',
      blobs: 'id, type',
    });
  }
}

export const db = new ContinuumOfflineDB();
export default db;
