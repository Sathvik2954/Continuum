import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IMedication extends MongooseDocument {
  consultationId: Types.ObjectId;
  patientId: Types.ObjectId;
  prescribedByDoctorId: Types.ObjectId;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
  startDate: Date;
  isExpired: boolean; // Virtual property computed dynamically
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema<IMedication>(
  {
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    prescribedByDoctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    frequency: {
      type: String,
      required: true,
      trim: true,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    instructions: {
      type: String,
      default: '',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property to calculate expiration dynamically on query reads
medicationSchema.virtual('isExpired').get(function (this: IMedication) {
  const expiryDate = new Date(this.startDate);
  expiryDate.setDate(expiryDate.getDate() + this.durationDays);
  return expiryDate < new Date();
});

// Composite index to speed up clinical summaries
medicationSchema.index({ patientId: 1, isExpired: 1 });

export const Medication = model<IMedication>('Medication', medicationSchema);
export default Medication;
