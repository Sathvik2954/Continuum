import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface ISymptomsChecklist {
  fever: boolean;
  cough: boolean;
  breathlessness: boolean;
  chestPain: boolean;
  headache: boolean;
  fatigue: boolean;
  nausea: boolean;
  dizziness: boolean;
  swelling: boolean;
  other?: string;
}

export interface IConsultation extends MongooseDocument {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  type: 'ASYNC' | 'LIVE_CALL';
  initiatedBy: 'PATIENT' | 'DOCTOR';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: string; // ASYNC: PATIENT_SUBMITTED, DOCTOR_REVIEWING, DOCTOR_RESPONDED, FOLLOW_UP_PENDING, CLOSED, DOCTOR_CHECKIN, PATIENT_RESPONDED. LIVE_CALL: SCHEDULED, PATIENT_JOINED, DOCTOR_JOINED, ACTIVE, ENDED, RECORDED
  checkinTopic?: string;
  symptomsChecklist?: ISymptomsChecklist;
  patientNotes?: string;
  symptomAudioUrl?: string;
  doctorResponseAudioUrl?: string;
  doctorNotes?: string;
  callScheduledAt?: Date;
  callStartedAt?: Date;
  callEndedAt?: Date;
  callDurationSeconds?: number;
  callRecordingUrl?: string;
  callRecordingUploadStatus?: 'PENDING' | 'UPLOADED' | 'FAILED';
  followUpDate?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const symptomsChecklistSchema = new Schema<ISymptomsChecklist>({
  fever: { type: Boolean, default: false },
  cough: { type: Boolean, default: false },
  breathlessness: { type: Boolean, default: false },
  chestPain: { type: Boolean, default: false },
  headache: { type: Boolean, default: false },
  fatigue: { type: Boolean, default: false },
  nausea: { type: Boolean, default: false },
  dizziness: { type: Boolean, default: false },
  swelling: { type: Boolean, default: false },
  other: { type: String, default: '' },
}, { _id: false });

const consultationSchema = new Schema<IConsultation>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['ASYNC', 'LIVE_CALL'],
    },
    initiatedBy: {
      type: String,
      required: true,
      enum: ['PATIENT', 'DOCTOR'],
    },
    priority: {
      type: String,
      required: true,
      enum: ['NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      required: true,
    },
    checkinTopic: {
      type: String,
    },
    symptomsChecklist: {
      type: symptomsChecklistSchema,
    },
    patientNotes: {
      type: String,
    },
    symptomAudioUrl: {
      type: String,
    },
    doctorResponseAudioUrl: {
      type: String,
    },
    doctorNotes: {
      type: String,
    },
    callScheduledAt: {
      type: Date,
    },
    callStartedAt: {
      type: Date,
    },
    callEndedAt: {
      type: Date,
    },
    callDurationSeconds: {
      type: Number,
    },
    callRecordingUrl: {
      type: String,
    },
    callRecordingUploadStatus: {
      type: String,
      enum: ['PENDING', 'UPLOADED', 'FAILED'],
    },
    followUpDate: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

consultationSchema.index({ patientId: 1, createdAt: -1 });
consultationSchema.index({ doctorId: 1, status: 1, createdAt: -1 });

consultationSchema.pre('find', function () {
  this.where({ isDeleted: false });
});

consultationSchema.pre('findOne', function () {
  this.where({ isDeleted: false });
});

export const Consultation = model<IConsultation>('Consultation', consultationSchema);
export default Consultation;
