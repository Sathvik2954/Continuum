import mongoose, { Document, Schema } from 'mongoose';

export type ConditionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';
export type ConditionStatus = 'ACTIVE' | 'RESOLVED';

export interface ICondition extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  addedByDoctorId: mongoose.Types.ObjectId;
  consultationId?: mongoose.Types.ObjectId;
  conditionName: string;
  severity: ConditionSeverity;
  diagnosedOn: Date;
  status: ConditionStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConditionSchema = new Schema<ICondition>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    addedByDoctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    conditionName: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['MILD', 'MODERATE', 'SEVERE'], required: true },
    diagnosedOn: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

ConditionSchema.index({ patientId: 1, status: 1 });
ConditionSchema.index({ patientId: 1, createdAt: -1 });

export const Condition = mongoose.model<ICondition>('Condition', ConditionSchema);
