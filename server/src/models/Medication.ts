import mongoose, { Document, Schema } from 'mongoose';

export interface IMedication extends Document {
  _id: mongoose.Types.ObjectId;
  consultationId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  prescribedByDoctorId: mongoose.Types.ObjectId;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  startDate: Date;
  createdAt: Date;
}

const MedicationSchema = new Schema<IMedication>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescribedByDoctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    durationDays: { type: Number, required: true, min: 1 },
    instructions: { type: String, trim: true },
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MedicationSchema.index({ patientId: 1, createdAt: -1 });
MedicationSchema.index({ consultationId: 1 });

// Virtual — computed on read, not stored (avoids stale data)
MedicationSchema.virtual('isExpired').get(function (this: IMedication) {
  const endDate = new Date(this.startDate);
  endDate.setDate(endDate.getDate() + this.durationDays);
  return endDate < new Date();
});

MedicationSchema.set('toJSON', { virtuals: true });
MedicationSchema.set('toObject', { virtuals: true });

export const Medication = mongoose.model<IMedication>('Medication', MedicationSchema);
