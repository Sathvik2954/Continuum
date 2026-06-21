import mongoose, { Document, Schema } from 'mongoose';

export type FollowUpType = 'IN_PERSON' | 'AUDIO_CHECKIN' | 'VITALS_CHECK' | 'LIVE_CALL';

export interface IFollowUp extends Document {
  _id: mongoose.Types.ObjectId;
  consultationId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  scheduledDate: Date;
  type: FollowUpType;
  notes?: string;
  completed: boolean;
  completedAt?: Date;
  completionNotes?: string;
  createdAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['IN_PERSON', 'AUDIO_CHECKIN', 'VITALS_CHECK', 'LIVE_CALL'],
      default: 'IN_PERSON',
    },
    notes: { type: String, trim: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    completionNotes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FollowUpSchema.index({ patientId: 1, scheduledDate: 1, completed: 1 });
FollowUpSchema.index({ doctorId: 1, completed: 1, scheduledDate: 1 });

export const FollowUp = mongoose.model<IFollowUp>('FollowUp', FollowUpSchema);
