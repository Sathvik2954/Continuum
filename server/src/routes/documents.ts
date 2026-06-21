import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import { imageUpload } from '../middleware/uploadImage';
import { DocumentModel } from '../models/Document';
import { PatientDoctorLink } from '../models/PatientDoctorLink';

const router = Router();
router.use(verifyToken);

// ─── Upload a document for self (patient) ─────────────────────────────────────
// multipart/form-data: documentType, consultationId (optional), + 'file'

router.post(
  '/me',
  imageUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.user!;
      const { documentType, consultationId } = req.body;

      if (role !== 'PATIENT') {
        res.status(403).json({ error: 'Only patients can upload to their own record this way' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      if (!documentType) {
        res.status(400).json({ error: 'documentType is required' });
        return;
      }

      const fileUrl = `/uploads/documents/${req.file.filename}`;
      const fileSizeKb = Math.round(req.file.size / 1024);

      const doc = await DocumentModel.create({
        patientId: new mongoose.Types.ObjectId(userId),
        consultationId: consultationId ? new mongoose.Types.ObjectId(consultationId) : undefined,
        uploadedBy: new mongoose.Types.ObjectId(userId),
        documentType,
        fileUrl,
        fileName: req.file.originalname,
        fileSizeKb,
      });

      res.status(201).json({ document: doc });
    } catch (err) {
      console.error('Document upload error:', err);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// ─── Upload a document for a specific patient (doctor) ────────────────────────

router.post(
  '/patients/:patientId',
  assertPatientAccess('patientId'),
  imageUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.user!;
      const { patientId } = req.params;
      const { documentType, consultationId } = req.body;

      if (role !== 'DOCTOR') {
        res.status(403).json({ error: 'Use /documents/me to upload your own documents' });
        return;
      }

      // Double-check ACTIVE link (assertPatientAccess already does this, defense in depth)
      const link = await PatientDoctorLink.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        doctorId: new mongoose.Types.ObjectId(userId),
        status: 'ACTIVE',
      });
      if (!link) {
        res.status(403).json({ error: 'Not connected with this patient' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      if (!documentType) {
        res.status(400).json({ error: 'documentType is required' });
        return;
      }

      const fileUrl = `/uploads/documents/${req.file.filename}`;
      const fileSizeKb = Math.round(req.file.size / 1024);

      const doc = await DocumentModel.create({
        patientId: new mongoose.Types.ObjectId(patientId),
        consultationId: consultationId ? new mongoose.Types.ObjectId(consultationId) : undefined,
        uploadedBy: new mongoose.Types.ObjectId(userId),
        documentType,
        fileUrl,
        fileName: req.file.originalname,
        fileSizeKb,
      });

      res.status(201).json({ document: doc });
    } catch (err) {
      console.error('Document upload error:', err);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// ─── GET documents for a patient (both roles, access-checked) ────────────────

router.get(
  '/patients/:patientId',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const documents = await DocumentModel.find({
        patientId: new mongoose.Types.ObjectId(patientId),
      }).sort({ uploadedAt: -1 });

      res.json({ documents });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }
);

export default router;
