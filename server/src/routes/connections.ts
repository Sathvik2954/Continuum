import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { PatientDoctorLink } from '../models/PatientDoctorLink';
import { DoctorProfile } from '../models/DoctorProfile';
import { User } from '../models/User';

const router = Router();
router.use(verifyToken);

// ─── PATIENT: Send connection request ────────────────────────────────────────

router.post('/request', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId } = req.body;
    const patientId = req.user!.userId;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(400).json({ error: 'Valid doctorId is required' });
      return;
    }

    // Verify doctor exists and is verified
    const doctorProfile = await DoctorProfile.findOne({
      userId: new mongoose.Types.ObjectId(doctorId),
      verified: true,
      isDeleted: false,
    });

    if (!doctorProfile) {
      res.status(404).json({ error: 'Doctor not found or not yet verified' });
      return;
    }

    // Check for existing non-expired link
    const existing = await PatientDoctorLink.findOne({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: { $in: ['PENDING', 'ACTIVE'] },
    });

    if (existing) {
      res.status(409).json({
        error: existing.status === 'ACTIVE'
          ? 'You are already connected with this doctor'
          : 'A connection request is already pending',
      });
      return;
    }

    const link = await PatientDoctorLink.create({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'PENDING',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.status(201).json({ message: 'Connection request sent', link });
  } catch (err) {
    console.error('Connection request error:', err);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// ─── DOCTOR: Respond to request (accept / decline) ───────────────────────────

router.patch('/:linkId/respond', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const { action } = req.body; // 'accept' | 'decline'
    const doctorId = req.user!.userId;

    if (!['accept', 'decline'].includes(action)) {
      res.status(400).json({ error: "action must be 'accept' or 'decline'" });
      return;
    }

    const link = await PatientDoctorLink.findOne({
      _id: new mongoose.Types.ObjectId(linkId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'PENDING',
    });

    if (!link) {
      res.status(404).json({ error: 'Pending request not found' });
      return;
    }

    // Check not expired
    if (new Date() > link.expiresAt) {
      await PatientDoctorLink.updateOne({ _id: link._id }, { status: 'EXPIRED' });
      res.status(410).json({ error: 'This request has expired' });
      return;
    }

    link.status = action === 'accept' ? 'ACTIVE' : 'DECLINED';
    link.respondedAt = new Date();
    await link.save();

    res.json({
      message: action === 'accept' ? 'Connection accepted' : 'Connection declined',
      link,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

// ─── PATIENT: Revoke access ───────────────────────────────────────────────────

router.delete('/:linkId', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const patientId = req.user!.userId;

    const link = await PatientDoctorLink.findOne({
      _id: new mongoose.Types.ObjectId(linkId),
      patientId: new mongoose.Types.ObjectId(patientId),
      status: { $in: ['ACTIVE', 'PENDING'] },
    });

    if (!link) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    link.status = 'REVOKED';
    link.revokedAt = new Date();
    await link.save();

    res.json({ message: 'Access revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

// ─── PATIENT: Get my doctors (active + pending) ───────────────────────────────

router.get('/my-doctors', requireRole('PATIENT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.user!.userId;

    const links = await PatientDoctorLink.find({
      patientId: new mongoose.Types.ObjectId(patientId),
      status: { $in: ['ACTIVE', 'PENDING'] },
    }).sort({ createdAt: -1 });

    // Populate doctor info
    const enriched = await Promise.all(
      links.map(async (link) => {
        const user = await User.findById(link.doctorId).select('name email');
        const profile = await DoctorProfile.findOne({ userId: link.doctorId });
        return { link, doctor: { ...user?.toObject(), ...profile?.toObject() } };
      })
    );

    res.json({ connections: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// ─── DOCTOR: Get my patients ──────────────────────────────────────────────────

router.get('/my-patients', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.userId;

    const links = await PatientDoctorLink.find({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'ACTIVE',
    }).sort({ updatedAt: -1 });

    const enriched = await Promise.all(
      links.map(async (link) => {
        const user = await User.findById(link.patientId).select('name email phone');
        return { link, patient: user };
      })
    );

    res.json({ patients: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// ─── DOCTOR: Get pending requests ────────────────────────────────────────────

router.get('/requests', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.userId;

    // Auto-expire stale pending requests on read
    await PatientDoctorLink.updateMany(
      {
        doctorId: new mongoose.Types.ObjectId(doctorId),
        status: 'PENDING',
        expiresAt: { $lt: new Date() },
      },
      { status: 'EXPIRED' }
    );

    const requests = await PatientDoctorLink.find({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'PENDING',
    }).sort({ requestedAt: -1 });

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const user = await User.findById(req.patientId).select('name email');
        return { link: req, patient: user };
      })
    );

    res.json({ requests: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;
