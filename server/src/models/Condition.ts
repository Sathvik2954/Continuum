import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface ICondition extends MongooseDocument {
  patientId: Types.ObjectId;
  addedByDoctorId: Types.ObjectId;
  consultationId?: Types.ObjectId;
  conditionName: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  diagnosedOn: Date;
  status: 'ACTIVE' | 'RESOLVED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const conditionSchema = new Schema<ICondition>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    addedByDoctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
    },
    conditionName: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['MILD', 'MODERATE', 'SEVERE'],
    },
    diagnosedOn: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'RESOLVED'],
      default: 'ACTIVE',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

conditionSchema.index({ patientId: 1, status: 1 });

export const Condition = model<ICondition>('Condition', conditionSchema);
export default Condition;
