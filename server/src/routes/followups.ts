import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import { FollowUp } from '../models/FollowUp';
import { Consultation } from '../models/Consultation';
import { PatientDoctorLink } from '../models/PatientDoctorLink';

const router = Router();
router.use(verifyToken);

// ─── DOCTOR: Schedule a follow-up (standalone, or called internally from
//     the consultation respond route) ─────────────────────────────────────────

router.post('/', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.userId;
    const { consultationId, scheduledDate, type, notes } = req.body;

    if (!consultationId || !scheduledDate) {
      res.status(400).json({ error: 'consultationId and scheduledDate are required' });
      return;
    }

    const consultation = await Consultation.findOne({
      _id: consultationId,
      doctorId: new mongoose.Types.ObjectId(doctorId),
    });

    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    // Verify ACTIVE link exists
    const link = await PatientDoctorLink.findOne({
      patientId: consultation.patientId,
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'ACTIVE',
    });

    if (!link) {
      res.status(403).json({ error: 'Access denied — no active connection with this patient' });
      return;
    }

    const followUp = await FollowUp.create({
      consultationId: new mongoose.Types.ObjectId(consultationId),
      patientId: consultation.patientId,
      doctorId: new mongoose.Types.ObjectId(doctorId),
      scheduledDate: new Date(scheduledDate),
      type: type || 'IN_PERSON',
      notes,
    });

    res.status(201).json({ followUp });
  } catch (err) {
    console.error('Schedule follow-up error:', err);
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

// ─── PATIENT: Mark follow-up as completed (offline-capable via sync queue) ───

router.patch('/:id/complete', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user!.userId;
    const { id } = req.params;
    const { completionNotes, completedAt } = req.body;

    const followUp = await FollowUp.findOne({
      _id: id,
      patientId: new mongoose.Types.ObjectId(patientId),
    });

    if (!followUp) {
      res.status(404).json({ error: 'Follow-up not found' });
      return;
    }

    followUp.completed = true;
    followUp.completedAt = completedAt ? new Date(completedAt) : new Date();
    followUp.completionNotes = completionNotes;
    await followUp.save();

    res.json({ followUp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark follow-up complete' });
  }
});

// ─── Sync-queue endpoint — for offline-queued completions ────────────────────
// Accepts { followUpId, completionNotes, completedAt } since the offline
// queue can't carry the :id as a URL param the same way.

router.post('/complete', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user!.userId;
    const { followUpId, completionNotes, completedAt } = req.body;

    if (!followUpId) {
      res.status(400).json({ error: 'followUpId is required' });
      return;
    }

    const followUp = await FollowUp.findOne({
      _id: followUpId,
      patientId: new mongoose.Types.ObjectId(patientId),
    });

    if (!followUp) {
      res.status(404).json({ error: 'Follow-up not found' });
      return;
    }

    followUp.completed = true;
    followUp.completedAt = completedAt ? new Date(completedAt) : new Date();
    followUp.completionNotes = completionNotes;
    await followUp.save();

    res.json({ followUp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark follow-up complete' });
  }
});

// ─── GET follow-ups for a patient (both roles, access-checked) ───────────────

router.get(
  '/patients/:patientId',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const { status } = req.query; // 'upcoming' | 'overdue' | 'completed' | undefined (all)

      const filter: Record<string, unknown> = {
        patientId: new mongoose.Types.ObjectId(patientId),
      };

      const now = new Date();
      if (status === 'upcoming') {
        filter.completed = false;
        filter.scheduledDate = { $gte: now };
      } else if (status === 'overdue') {
        filter.completed = false;
        filter.scheduledDate = { $lt: now };
      } else if (status === 'completed') {
        filter.completed = true;
      }

      const followUps = await FollowUp.find(filter).sort({ scheduledDate: 1 });

      res.json({ followUps });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch follow-ups' });
    }
  }
);

// ─── DOCTOR: Get all follow-ups across their patients ────────────────────────

router.get('/doctor/all', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.userId;
    const { status } = req.query;

    // Filter to only include patients with an ACTIVE link
    const activeLinks = await PatientDoctorLink.find({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'ACTIVE',
    }).select('patientId').lean();
    const activePatientIds = activeLinks.map((l) => l.patientId);

    const filter: Record<string, unknown> = {
      doctorId: new mongoose.Types.ObjectId(doctorId),
      patientId: { $in: activePatientIds },
    };

    const now = new Date();
    if (status === 'upcoming') {
      filter.completed = false;
      filter.scheduledDate = { $gte: now };
    } else if (status === 'overdue') {
      filter.completed = false;
      filter.scheduledDate = { $lt: now };
    }

    const followUps = await FollowUp.find(filter).sort({ scheduledDate: 1 });

    res.json({ followUps });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

export default router;
