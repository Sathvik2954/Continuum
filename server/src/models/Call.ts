import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface ICall extends MongooseDocument {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  scheduledBy: 'PATIENT' | 'DOCTOR';
  scheduledAt: Date;
  estimatedDurationMin: 15 | 30 | 45 | 60;
  preCallNotes?: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'PATIENT_JOINED' | 'DOCTOR_JOINED' | 'ACTIVE' | 'ENDED' | 'CANCELLED' | 'MISSED';
  consultationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const callSchema = new Schema<ICall>(
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
    scheduledBy: {
      type: String,
      required: true,
      enum: ['PATIENT', 'DOCTOR'],
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    estimatedDurationMin: {
      type: Number,
      required: true,
      enum: [15, 30, 45, 60],
    },
    preCallNotes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      required: true,
      enum: ['SCHEDULED', 'CONFIRMED', 'PATIENT_JOINED', 'DOCTOR_JOINED', 'ACTIVE', 'ENDED', 'CANCELLED', 'MISSED'],
      default: 'SCHEDULED',
    },
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
    },
  },
  {
    timestamps: true,
  }
);

callSchema.index({ patientId: 1, scheduledAt: -1 });
callSchema.index({ doctorId: 1, status: 1 });

export const Call = model<ICall>('Call', callSchema);
export default Call;
