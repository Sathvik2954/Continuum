import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { User } from '../models/User';
import { DoctorProfile } from '../models/DoctorProfile';
import { PatientProfile } from '../models/PatientProfile';

const router = Router();
router.use(verifyToken, requireRole('ADMIN'));

// ─── List all users ────────────────────────────────────────────────────────────

router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;

    const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).lean();

    // Attach verified status for doctors
    const enriched = await Promise.all(
      users.map(async (u) => {
        if (u.role === 'DOCTOR') {
          const profile = await DoctorProfile.findOne({ userId: u._id }).lean();
          return { ...u, verified: profile?.verified ?? false, specialization: profile?.specialization };
        }
        return u;
      })
    );

    res.json({ users: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── Verify a doctor ────────────────────────────────────────────────────────────

router.patch('/doctors/:userId/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { verified } = req.body; // allow toggling true/false

    const profile = await DoctorProfile.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { verified: verified !== false } },
      { new: true }
    );

    if (!profile) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

// ─── Soft-delete a user account ─────────────────────────────────────────────────

router.delete('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const uid = new mongoose.Types.ObjectId(userId);

    const user = await User.findById(uid);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.role === 'PATIENT') {
      await PatientProfile.updateOne({ userId: uid }, { isDeleted: true, deletedAt: new Date() });
    } else if (user.role === 'DOCTOR') {
      await DoctorProfile.updateOne({ userId: uid }, { isDeleted: true, deletedAt: new Date() });
    }

    res.json({ message: 'Account deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

export default router;
