import mongoose, { Document, Schema } from 'mongoose';

export type LinkStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED' | 'EXPIRED';

export interface IPatientDoctorLink extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  status: LinkStatus;
  requestedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PatientDoctorLinkSchema = new Schema<IPatientDoctorLink>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'DECLINED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
    },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
    },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

// Prevent duplicate active/pending links between same pair
PatientDoctorLinkSchema.index({ patientId: 1, doctorId: 1 });
PatientDoctorLinkSchema.index({ doctorId: 1, status: 1 });
PatientDoctorLinkSchema.index({ patientId: 1, status: 1 });
PatientDoctorLinkSchema.index({ expiresAt: 1 }); // for cron expiry

export const PatientDoctorLink = mongoose.model<IPatientDoctorLink>(
  'PatientDoctorLink',
  PatientDoctorLinkSchema
);
