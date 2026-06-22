import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import { Vital } from '../models/Vital';

const router = Router();
router.use(verifyToken);

// ─── PATIENT: Log vitals (also used by sync engine for offline-queued entries) ─

router.post('/', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user!.userId;
    const {
      recordedAt, bpSystolic, bpDiastolic,
      bloodGlucoseFasting, bloodGlucosePostMeal,
      weightKg, heartRate, notes,
    } = req.body;

    // Require at least one actual reading - don't allow empty vitals
    const hasAnyReading = [bpSystolic, bpDiastolic, bloodGlucoseFasting, bloodGlucosePostMeal, weightKg, heartRate]
      .some((v) => v !== undefined && v !== null && v !== '');

    if (!hasAnyReading) {
      res.status(400).json({ error: 'At least one vital reading is required' });
      return;
    }

    const vital = await Vital.create({
      patientId: new mongoose.Types.ObjectId(patientId),
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      bpSystolic, bpDiastolic, bloodGlucoseFasting, bloodGlucosePostMeal, weightKg, heartRate,
      notes,
    });

    res.status(201).json({ vital });
  } catch (err) {
    console.error('Vital log error:', err);
    res.status(500).json({ error: 'Failed to log vitals' });
  }
});

// ─── GET vitals for a patient (both roles, access-checked) ──────────────────

router.get(
  '/patients/:patientId',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const { limit = '50' } = req.query;

      const vitals = await Vital.find({
        patientId: new mongoose.Types.ObjectId(patientId),
      })
        .sort({ recordedAt: -1 })
        .limit(parseInt(limit as string));

      res.json({ vitals });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch vitals' });
    }
  }
);

export default router;
