import mongoose, { Document, Schema } from 'mongoose';

export interface IVital extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
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

const VitalSchema = new Schema<IVital>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedAt: { type: Date, required: true, default: Date.now },
    bpSystolic: { type: Number, min: 50, max: 300 },
    bpDiastolic: { type: Number, min: 30, max: 200 },
    bloodGlucoseFasting: { type: Number, min: 0, max: 1000 },
    bloodGlucosePostMeal: { type: Number, min: 0, max: 1000 },
    weightKg: { type: Number, min: 0, max: 500 },
    heartRate: { type: Number, min: 20, max: 250 },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

VitalSchema.index({ patientId: 1, recordedAt: -1 });

export const Vital = mongoose.model<IVital>('Vital', VitalSchema);
