import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IPatientDoctorLink extends MongooseDocument {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
  requestedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientDoctorLinkSchema = new Schema<IPatientDoctorLink>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'ACTIVE', 'DECLINED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days expiry
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: a patient can only have one link configuration with a particular doctor at a time
patientDoctorLinkSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });
patientDoctorLinkSchema.index({ doctorId: 1, status: 1 });
patientDoctorLinkSchema.index({ patientId: 1, status: 1 });

export const PatientDoctorLink = model<IPatientDoctorLink>('PatientDoctorLink', patientDoctorLinkSchema);
export default PatientDoctorLink;
