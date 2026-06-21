import mongoose, { Document as MongooseDocument, Schema } from 'mongoose';

export type DocumentType = 'LAB_REPORT' | 'PRESCRIPTION_SCAN' | 'IMAGING' | 'REFERRAL' | 'OTHER';

export interface IDocument extends MongooseDocument {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  consultationId?: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string;
  fileSizeKb: number;
  uploadedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  documentType: {
    type: String,
    enum: ['LAB_REPORT', 'PRESCRIPTION_SCAN', 'IMAGING', 'REFERRAL', 'OTHER'],
    required: true,
  },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSizeKb: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

DocumentSchema.index({ patientId: 1, uploadedAt: -1 });

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
