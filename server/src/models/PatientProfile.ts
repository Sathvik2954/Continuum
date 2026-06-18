import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IPatientProfile extends MongooseDocument {
  userId: Types.ObjectId;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
  knownAllergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientProfileSchema = new Schema<IPatientProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    },
    knownAllergies: {
      type: String,
      default: '',
    },
    emergencyContactName: {
      type: String,
      default: '',
    },
    emergencyContactPhone: {
      type: String,
      default: '',
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

// Middleware to automatically filter out soft-deleted items by default
patientProfileSchema.pre('find', function () {
  this.where({ isDeleted: false });
});

patientProfileSchema.pre('findOne', function () {
  this.where({ isDeleted: false });
});

export const PatientProfile = model<IPatientProfile>('PatientProfile', patientProfileSchema);
export default PatientProfile;
