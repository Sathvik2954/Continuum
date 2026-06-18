import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IDocument extends MongooseDocument {
  patientId: Types.ObjectId;
  consultationId?: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  documentType: 'LAB_REPORT' | 'PRESCRIPTION_SCAN' | 'IMAGING' | 'REFERRAL' | 'OTHER';
  fileUrl: string;
  fileName: string;
  fileSizeKb?: number;
  uploadedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: ['LAB_REPORT', 'PRESCRIPTION_SCAN', 'IMAGING', 'REFERRAL', 'OTHER'],
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSizeKb: {
      type: Number,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ patientId: 1, uploadedAt: -1 });

export const Document = model<IDocument>('Document', documentSchema);
export default Document;
