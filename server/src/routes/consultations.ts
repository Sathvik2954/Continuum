import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import { audioUpload } from '../middleware/upload';
import { Consultation, VALID_TRANSITIONS, ConsultationStatus } from '../models/Consultation';
import { Medication } from '../models/Medication';
import { PatientDoctorLink } from '../models/PatientDoctorLink';

const router = Router();
router.use(verifyToken);

// ─── PATIENT: Create async consultation (with optional audio) ────────────────
// multipart/form-data: fields + optional 'audio' file

router.post(
  '/',
  requireRole('PATIENT'),
  audioUpload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const patientId = req.user!.userId;
      const { doctorId, priority, symptomsChecklist, patientNotes } = req.body;

      if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
        res.status(400).json({ error: 'Valid doctorId is required' });
        return;
      }

      // Verify ACTIVE link exists
      const link = await PatientDoctorLink.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        doctorId: new mongoose.Types.ObjectId(doctorId),
        status: 'ACTIVE',
      });

      if (!link) {
        res.status(403).json({ error: 'You are not connected with this doctor' });
        return;
      }

      let parsedChecklist;
      try {
        parsedChecklist = symptomsChecklist ? JSON.parse(symptomsChecklist) : undefined;
      } catch {
        res.status(400).json({ error: 'symptomsChecklist must be valid JSON' });
        return;
      }

      const audioUrl = req.file ? `/uploads/audio/${req.file.filename}` : undefined;

      const consultation = await Consultation.create({
        patientId: new mongoose.Types.ObjectId(patientId),
        doctorId: new mongoose.Types.ObjectId(doctorId),
        type: 'ASYNC',
        initiatedBy: 'PATIENT',
        priority: priority || 'NORMAL',
        status: 'PATIENT_SUBMITTED',
        symptomsChecklist: parsedChecklist,
        patientNotes,
        symptomAudioUrl: audioUrl,
      });

      res.status(201).json({ message: 'Consultation submitted', consultation });
    } catch (err) {
      console.error('Create consultation error:', err);
      res.status(500).json({ error: 'Failed to create consultation' });
    }
  }
);

// ─── DOCTOR: Create check-in consultation ────────────────────────────────────

router.post('/checkin', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.userId;
    const { patientId, checkinTopic, patientNotes } = req.body;

    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      res.status(400).json({ error: 'Valid patientId is required' });
      return;
    }
    if (!checkinTopic) {
      res.status(400).json({ error: 'checkinTopic is required' });
      return;
    }

    const link = await PatientDoctorLink.findOne({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'ACTIVE',
    });

    if (!link) {
      res.status(403).json({ error: 'You are not connected with this patient' });
      return;
    }

    const consultation = await Consultation.create({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      type: 'ASYNC',
      initiatedBy: 'DOCTOR',
      priority: 'NORMAL',
      status: 'DOCTOR_CHECKIN',
      checkinTopic,
      doctorNotes: patientNotes,
    });

    res.status(201).json({ message: 'Check-in created', consultation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create check-in' });
  }
});

// ─── GET consultations — role-aware list ──────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const { status, priority } = req.query;

    const filter: Record<string, unknown> = { isDeleted: false };

    if (role === 'PATIENT') {
      filter.patientId = new mongoose.Types.ObjectId(userId);
    } else if (role === 'DOCTOR') {
      filter.doctorId = new mongoose.Types.ObjectId(userId);
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const consultations = await Consultation.find(filter)
      .sort({ priority: 1, createdAt: -1 }) // URGENT/HIGH bubble via priority sort below
      .lean();

    // Sort: URGENT first, then HIGH, then NORMAL, each by recency
    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2 };
    consultations.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({ consultations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

// ─── GET single consultation (with medications) ──────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid consultation ID' });
      return;
    }

    const consultation = await Consultation.findOne({ _id: id, isDeleted: false });
    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    // Access check
    const isOwner =
      (role === 'PATIENT' && consultation.patientId.toString() === userId) ||
      (role === 'DOCTOR' && consultation.doctorId.toString() === userId);

    if (!isOwner && role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const medications = await Medication.find({ consultationId: id }).lean();

    res.json({ consultation, medications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
});

// ─── DOCTOR: Mark as reviewing ────────────────────────────────────────────────

router.patch('/:id/review', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.userId;
    const { id } = req.params;

    const consultation = await Consultation.findOne({
      _id: id,
      doctorId: new mongoose.Types.ObjectId(doctorId),
      isDeleted: false,
    });

    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    if (!canTransition(consultation.status, 'DOCTOR_REVIEWING')) {
      res.status(400).json({ error: `Cannot transition from ${consultation.status} to DOCTOR_REVIEWING` });
      return;
    }

    consultation.status = 'DOCTOR_REVIEWING';
    await consultation.save();

    res.json({ consultation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ─── DOCTOR: Respond to consultation ──────────────────────────────────────────
// multipart/form-data: doctorNotes, followUpDate, medications (JSON string), + optional 'audio' file

router.post(
  '/:id/respond',
  requireRole('DOCTOR'),
  audioUpload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.user!.userId;
      const { id } = req.params;
      const { doctorNotes, followUpDate, medications } = req.body;

      const consultation = await Consultation.findOne({
        _id: id,
        doctorId: new mongoose.Types.ObjectId(doctorId),
        isDeleted: false,
      });

      if (!consultation) {
        res.status(404).json({ error: 'Consultation not found' });
        return;
      }

      if (!canTransition(consultation.status, 'DOCTOR_RESPONDED')) {
        res.status(400).json({
          error: `Cannot respond — consultation is in ${consultation.status} state`,
        });
        return;
      }

      // Parse medications array
      let parsedMeds: Array<{
        medicineName: string; dosage: string; frequency: string;
        durationDays: number; instructions?: string;
      }> = [];
      if (medications) {
        try {
          parsedMeds = JSON.parse(medications);
        } catch {
          res.status(400).json({ error: 'medications must be valid JSON array' });
          return;
        }
      }

      const audioUrl = req.file ? `/uploads/audio/${req.file.filename}` : undefined;

      consultation.status = followUpDate ? 'FOLLOW_UP_PENDING' : 'DOCTOR_RESPONDED';
      consultation.doctorNotes = doctorNotes;
      consultation.doctorResponseAudioUrl = audioUrl || consultation.doctorResponseAudioUrl;
      if (followUpDate) consultation.followUpDate = new Date(followUpDate);
      await consultation.save();

      // Insert medications
      if (parsedMeds.length > 0) {
        await Medication.insertMany(
          parsedMeds.map((med) => ({
            consultationId: consultation._id,
            patientId: consultation.patientId,
            prescribedByDoctorId: new mongoose.Types.ObjectId(doctorId),
            medicineName: med.medicineName,
            dosage: med.dosage,
            frequency: med.frequency,
            durationDays: med.durationDays,
            instructions: med.instructions,
            startDate: new Date(),
          }))
        );
      }

      const savedMeds = await Medication.find({ consultationId: consultation._id });

      res.json({ message: 'Response submitted', consultation, medications: savedMeds });
    } catch (err) {
      console.error('Respond error:', err);
      res.status(500).json({ error: 'Failed to submit response' });
    }
  }
);

// ─── PATIENT: Close consultation ──────────────────────────────────────────────

router.patch('/:id/close', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user!.userId;
    const { id } = req.params;

    const consultation = await Consultation.findOne({
      _id: id,
      patientId: new mongoose.Types.ObjectId(patientId),
      isDeleted: false,
    });

    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    if (!canTransition(consultation.status, 'CLOSED')) {
      res.status(400).json({ error: `Cannot close from ${consultation.status} state` });
      return;
    }

    consultation.status = 'CLOSED';
    await consultation.save();

    res.json({ consultation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close consultation' });
  }
});

// ─── Helper: state machine guard ──────────────────────────────────────────────

function canTransition(from: ConsultationStatus, to: ConsultationStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export default router;
