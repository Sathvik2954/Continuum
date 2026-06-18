import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IVital extends MongooseDocument {
  patientId: Types.ObjectId;
  recordedAt: Date;
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodGlucoseFasting?: number;
  bloodGlucosePostMeal?: number;
  weightKg?: number;
  heartRate?: number;
  notes?: string;
  createdAt: Date;
}

const vitalSchema = new Schema<IVital>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    bpSystolic: { type: Number },
    bpDiastolic: { type: Number },
    bloodGlucoseFasting: { type: Number },
    bloodGlucosePostMeal: { type: Number },
    weightKg: { type: Number },
    heartRate: { type: Number },
    notes: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only need creation timestamp
  }
);

vitalSchema.index({ patientId: 1, recordedAt: -1 });

export const Vital = model<IVital>('Vital', vitalSchema);
export default Vital;
