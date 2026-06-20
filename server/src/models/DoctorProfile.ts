import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctorProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  specialization: string;
  clinicName: string;
  city: string;
  registrationNumber: string;
  verified: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorProfileSchema = new Schema<IDoctorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    specialization: { type: String, required: true, trim: true },
    clinicName: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

DoctorProfileSchema.index({ specialization: 'text', city: 'text' });

export const DoctorProfile = mongoose.model<IDoctorProfile>(
  'DoctorProfile',
  DoctorProfileSchema
);