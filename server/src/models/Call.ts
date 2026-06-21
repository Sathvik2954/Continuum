import mongoose, { Document, Schema } from 'mongoose';

export type CallStatus =
  | 'SCHEDULED' | 'CONFIRMED' | 'PATIENT_JOINED' | 'DOCTOR_JOINED'
  | 'ACTIVE' | 'ENDED' | 'CANCELLED' | 'MISSED';

export interface ICall extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  scheduledBy: 'PATIENT' | 'DOCTOR';
  scheduledAt: Date;
  estimatedDurationMin: number;
  preCallNotes?: string;
  status: CallStatus;
  consultationId?: mongoose.Types.ObjectId; // set after call ends + recording processed
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledBy: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
    scheduledAt: { type: Date, required: true },
    estimatedDurationMin: { type: Number, default: 15 },
    preCallNotes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'CONFIRMED', 'PATIENT_JOINED', 'DOCTOR_JOINED', 'ACTIVE', 'ENDED', 'CANCELLED', 'MISSED'],
      default: 'SCHEDULED',
    },
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

CallSchema.index({ patientId: 1, scheduledAt: -1 });
CallSchema.index({ doctorId: 1, status: 1 });

export const Call = mongoose.model<ICall>('Call', CallSchema);
