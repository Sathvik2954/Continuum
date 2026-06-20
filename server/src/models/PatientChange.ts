import mongoose, { Document, Schema } from 'mongoose';

export interface IPatientChange extends Document {
  patientId: mongoose.Types.ObjectId;
  entityType: 'PROFILE' | 'CONDITION' | 'CONSULTATION' | 'MEDICATION';
  entityId: mongoose.Types.ObjectId;
  fieldChanged: string;
  oldValue?: string;
  newValue?: string;
  changedBy: mongoose.Types.ObjectId;
  changedByRole: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  changedAt: Date;
}

const PatientChangeSchema = new Schema<IPatientChange>({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  entityType: {
    type: String,
    enum: ['PROFILE', 'CONDITION', 'CONSULTATION', 'MEDICATION'],
    required: true,
  },
  entityId: { type: Schema.Types.ObjectId, required: true },
  fieldChanged: { type: String, required: true },
  oldValue: { type: String },
  newValue: { type: String },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changedByRole: {
    type: String,
    enum: ['PATIENT', 'DOCTOR', 'ADMIN'],
    required: true,
  },
  changedAt: { type: Date, default: Date.now },
});

// Audit logs are never deleted — no isDeleted field intentionally
PatientChangeSchema.index({ patientId: 1, changedAt: -1 });

export const PatientChange = mongoose.model<IPatientChange>(
  'PatientChange',
  PatientChangeSchema
);
