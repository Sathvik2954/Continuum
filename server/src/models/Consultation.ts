import mongoose, { Document, Schema } from 'mongoose';

export type ConsultationStatus =
  | 'PATIENT_SUBMITTED'
  | 'DOCTOR_REVIEWING'
  | 'DOCTOR_RESPONDED'
  | 'FOLLOW_UP_PENDING'
  | 'CLOSED'
  | 'DOCTOR_CHECKIN'
  | 'PATIENT_RESPONDED';

export type Priority = 'NORMAL' | 'HIGH' | 'URGENT';
export type InitiatedBy = 'PATIENT' | 'DOCTOR';

export interface ISymptomsChecklist {
  fever?: boolean;
  cough?: boolean;
  breathlessness?: boolean;
  chestPain?: boolean;
  headache?: boolean;
  fatigue?: boolean;
  nausea?: boolean;
  dizziness?: boolean;
  swelling?: boolean;
  other?: string;
}

export interface IConsultation extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  type: 'ASYNC' | 'LIVE_CALL';
  initiatedBy: InitiatedBy;
  priority: Priority;
  status: ConsultationStatus;

  checkinTopic?: string;
  symptomsChecklist?: ISymptomsChecklist;
  patientNotes?: string;
  symptomAudioUrl?: string;
  doctorResponseAudioUrl?: string;
  doctorNotes?: string;

  followUpDate?: Date;

  // Live call-specific fields (Phase 8)
  callDurationSeconds?: number;

  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SymptomsChecklistSchema = new Schema<ISymptomsChecklist>(
  {
    fever: { type: Boolean, default: false },
    cough: { type: Boolean, default: false },
    breathlessness: { type: Boolean, default: false },
    chestPain: { type: Boolean, default: false },
    headache: { type: Boolean, default: false },
    fatigue: { type: Boolean, default: false },
    nausea: { type: Boolean, default: false },
    dizziness: { type: Boolean, default: false },
    swelling: { type: Boolean, default: false },
    other: { type: String, trim: true },
  },
  { _id: false }
);

const ConsultationSchema = new Schema<IConsultation>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['ASYNC', 'LIVE_CALL'], default: 'ASYNC' },
    initiatedBy: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
    priority: { type: String, enum: ['NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    status: {
      type: String,
      enum: [
        'PATIENT_SUBMITTED', 'DOCTOR_REVIEWING', 'DOCTOR_RESPONDED',
        'FOLLOW_UP_PENDING', 'CLOSED', 'DOCTOR_CHECKIN', 'PATIENT_RESPONDED',
      ],
      default: 'PATIENT_SUBMITTED',
    },

    checkinTopic: { type: String, trim: true },
    symptomsChecklist: { type: SymptomsChecklistSchema },
    patientNotes: { type: String, trim: true },
    symptomAudioUrl: { type: String },
    doctorResponseAudioUrl: { type: String },
    doctorNotes: { type: String, trim: true },

    followUpDate: { type: Date },

    callDurationSeconds: { type: Number },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

ConsultationSchema.index({ patientId: 1, createdAt: -1 });
ConsultationSchema.index({ doctorId: 1, status: 1, createdAt: -1 });
ConsultationSchema.index({ priority: 1 });

// ── Status transition validation ──────────────────────────────────────────────
// Valid transitions are enforced at the route level, not the schema level,
// since Mongoose pre-save hooks can't easily access "previous" status without
// an extra query. See routes/consultations.ts for the state machine guard.

export const VALID_TRANSITIONS: Record<ConsultationStatus, ConsultationStatus[]> = {
  PATIENT_SUBMITTED: ['DOCTOR_REVIEWING', 'DOCTOR_RESPONDED', 'FOLLOW_UP_PENDING'],
  DOCTOR_REVIEWING:  ['DOCTOR_RESPONDED', 'FOLLOW_UP_PENDING'],
  DOCTOR_RESPONDED:  ['FOLLOW_UP_PENDING', 'CLOSED'],
  FOLLOW_UP_PENDING: ['CLOSED'],
  CLOSED:            [],
  DOCTOR_CHECKIN:    ['PATIENT_RESPONDED'],
  PATIENT_RESPONDED: ['DOCTOR_REVIEWING', 'DOCTOR_RESPONDED', 'FOLLOW_UP_PENDING'],
};

export const Consultation = mongoose.model<IConsultation>('Consultation', ConsultationSchema);
