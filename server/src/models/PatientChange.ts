import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IPatientChange extends MongooseDocument {
  patientId: Types.ObjectId;
  entityType: 'PROFILE' | 'CONDITION' | 'CONSULTATION' | 'MEDICATION';
  entityId: Types.ObjectId;
  fieldChanged: string;
  oldValue?: string;
  newValue?: string;
  changedBy: Types.ObjectId;
  changedByRole: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  changedAt: Date;
}

const patientChangeSchema = new Schema<IPatientChange>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['PROFILE', 'CONDITION', 'CONSULTATION', 'MEDICATION'],
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    fieldChanged: {
      type: String,
      required: true,
      trim: true,
    },
    oldValue: {
      type: String,
    },
    newValue: {
      type: String,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedByRole: {
      type: String,
      required: true,
      enum: ['PATIENT', 'DOCTOR', 'ADMIN'],
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    // No soft deletes allowed on audit collections
    timestamps: { createdAt: 'changedAt', updatedAt: false },
  }
);

patientChangeSchema.index({ patientId: 1, changedAt: -1 });

export const PatientChange = model<IPatientChange>('PatientChange', patientChangeSchema);
export default PatientChange;
