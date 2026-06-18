import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IDoctorProfile extends MongooseDocument {
  userId: Types.ObjectId;
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

const doctorProfileSchema = new Schema<IDoctorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    clinicName: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    verified: {
      type: Boolean,
      required: true,
      default: false,
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

// Indexes for optimized searching in Phase 2
doctorProfileSchema.index({ specialization: 1 });

// Soft delete filters
doctorProfileSchema.pre('find', function () {
  this.where({ isDeleted: false });
});

doctorProfileSchema.pre('findOne', function () {
  this.where({ isDeleted: false });
});

export const DoctorProfile = model<IDoctorProfile>('DoctorProfile', doctorProfileSchema);
export default DoctorProfile;
