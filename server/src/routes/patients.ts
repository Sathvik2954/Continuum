import { Router, Request, Response } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { auditLog } from '../middleware/auditTrail';
import { PatientProfile } from '../models/PatientProfile';
import { User } from '../models/User';
import { Medication } from '../models/Medication';

const router = Router();

// All patient routes require auth
router.use(verifyToken);

// ─── GET own medications ──────────────────────────────────────────────────────

router.get('/me/medications', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const medications = await Medication.find({ patientId: req.user!.userId }).sort({ startDate: -1 });
    res.json({ medications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// ─── GET own profile ──────────────────────────────────────────────────────────

router.get('/me/profile', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await PatientProfile.findOne({
      userId: req.user!.userId,
      isDeleted: false,
    });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const user = await User.findById(req.user!.userId).select('-passwordHash');
    res.json({ profile, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── UPDATE own profile ───────────────────────────────────────────────────────

router.patch(
  '/me/profile',
  requireRole('PATIENT'),
  auditLog({
    entityType: 'PROFILE',
    getPatientId: (req) => req.user!.userId,
    getEntityId: (req) => req.user!.userId,
    fields: [
      'dateOfBirth', 'gender', 'bloodGroup',
      'knownAllergies', 'emergencyContactName', 'emergencyContactPhone',
    ],
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        dateOfBirth, gender, bloodGroup,
        knownAllergies, emergencyContactName, emergencyContactPhone,
      } = req.body;

      const profile = await PatientProfile.findOneAndUpdate(
        { userId: req.user!.userId, isDeleted: false },
        {
          $set: {
            ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
            ...(gender && { gender }),
            ...(bloodGroup && { bloodGroup }),
            ...(knownAllergies !== undefined && { knownAllergies }),
            ...(emergencyContactName !== undefined && { emergencyContactName }),
            ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
          },
        },
        { new: true }
      );

      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json({ profile });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// ─── SYNC endpoint - receive offline-created profile ─────────────────────────
// Called by the client sync engine when it comes online

router.post('/sync/profile', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      dateOfBirth, gender, bloodGroup,
      knownAllergies, emergencyContactName, emergencyContactPhone,
      updatedAt: clientUpdatedAt,
    } = req.body;

    const existing = await PatientProfile.findOne({
      userId: req.user!.userId,
      isDeleted: false,
    });

    // Conflict check - reject stale writes
    if (existing && clientUpdatedAt) {
      const serverTime = new Date(existing.updatedAt).getTime();
      const clientTime = new Date(clientUpdatedAt).getTime();
      if (clientTime < serverTime) {
        res.status(409).json({
          error: 'Conflict - server has a newer version',
          serverUpdatedAt: existing.updatedAt,
        });
        return;
      }
    }

    const profile = await PatientProfile.findOneAndUpdate(
      { userId: req.user!.userId },
      {
        $set: {
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          ...(gender && { gender }),
          ...(bloodGroup && { bloodGroup }),
          ...(knownAllergies !== undefined && { knownAllergies }),
          ...(emergencyContactName !== undefined && { emergencyContactName }),
          ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
        },
      },
      { new: true, upsert: true }
    );

    res.json({ synced: true, profile });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
