import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IFollowUp extends MongooseDocument {
  consultationId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  scheduledDate: Date;
  type: 'IN_PERSON' | 'AUDIO_CHECKIN' | 'VITALS_CHECK' | 'LIVE_CALL';
  notes?: string;
  completed: boolean;
  completedAt?: Date;
  completionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const followUpSchema = new Schema<IFollowUp>(
  {
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
    },
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
    scheduledDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['IN_PERSON', 'AUDIO_CHECKIN', 'VITALS_CHECK', 'LIVE_CALL'],
    },
    notes: {
      type: String,
      default: '',
    },
    completed: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    completionNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

followUpSchema.index({ patientId: 1, scheduledDate: 1, completed: 1 });
followUpSchema.index({ doctorId: 1, completed: 1, scheduledDate: 1 });

export const FollowUp = model<IFollowUp>('FollowUp', followUpSchema);
export default FollowUp;
