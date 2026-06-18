import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import requireRole from '../middleware/roleGuard';
import PatientDoctorLink from '../models/PatientDoctorLink';
import DoctorProfile from '../models/DoctorProfile';
import PatientProfile from '../models/PatientProfile';
import User from '../models/User';

const router = Router();

// POST /api/connections/request - Patient sends a connection request to a doctor
router.post('/request', verifyToken, requireRole('PATIENT'), async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const { doctorId } = req.body;

  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor ID is required' });
  }

  try {
    // 1. Confirm the doctor exists and is verified
    const doctorProfile = await DoctorProfile.findOne({ userId: doctorId, verified: true });
    if (!doctorProfile) {
      return res.status(404).json({ error: 'Verified doctor profile not found' });
    }

    // 2. Look for an existing link record
    let link = await PatientDoctorLink.findOne({ patientId, doctorId });

    if (link) {
      if (link.status === 'ACTIVE') {
        return res.status(400).json({ error: 'You are already connected with this doctor' });
      }
      if (link.status === 'PENDING' && link.expiresAt > new Date()) {
        return res.status(400).json({ error: 'A connection request is already pending with this doctor' });
      }

      // If connection was declined, revoked, or expired, reset to PENDING
      link.status = 'PENDING';
      link.requestedAt = new Date();
      link.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Reset 7 day timer
      link.respondedAt = undefined;
      link.revokedAt = undefined;
      await link.save();
    } else {
      // Create a fresh relationship link
      link = new PatientDoctorLink({
        patientId,
        doctorId,
        status: 'PENDING',
      });
      await link.save();
    }

    return res.status(201).json(link);
  } catch (error) {
    console.error('Failed to create connection request:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/connections/:id/respond - Doctor accepts or declines a request
router.patch('/:id/respond', verifyToken, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  const doctorId = req.user!.userId;
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'DECLINED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid response status selection (ACTIVE or DECLINED)' });
  }

  try {
    const link = await PatientDoctorLink.findById(id);
    if (!link) {
      return res.status(404).json({ error: 'Connection link not found' });
    }

    // Ensure this doctor is the intended recipient
    if (link.doctorId.toString() !== doctorId) {
      return res.status(403).json({ error: 'Forbidden: You cannot respond to this link request' });
    }

    if (link.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot respond. Request is already in status: ${link.status}` });
    }

    if (link.expiresAt <= new Date()) {
      link.status = 'EXPIRED';
      await link.save();
      return res.status(400).json({ error: 'This connection request has expired' });
    }

    link.status = status;
    link.respondedAt = new Date();
    await link.save();

    return res.status(200).json(link);
  } catch (error) {
    console.error('Failed to respond to connection link:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/connections/:id - Patient or Doctor revokes/rescinds access
router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const link = await PatientDoctorLink.findById(id);
    if (!link) {
      return res.status(404).json({ error: 'Connection link not found' });
    }

    // Verify requester matches patient or doctor
    const isPatient = link.patientId.toString() === userId;
    const isDoctor = link.doctorId.toString() === userId;

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to revoke this link' });
    }

    link.status = 'REVOKED';
    link.revokedAt = new Date();
    await link.save();

    return res.status(200).json({ success: true, message: 'Connection link revoked immediately' });
  } catch (error) {
    console.error('Failed to revoke connection link:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/connections/doctors - Get active linked doctors for patient
router.get('/doctors', verifyToken, requireRole('PATIENT'), async (req: Request, res: Response) => {
  const patientId = req.user!.userId;

  try {
    const activeLinks = await PatientDoctorLink.find({ patientId, status: 'ACTIVE' });
    const doctorIds = activeLinks.map((l) => l.doctorId);

    const doctors = await DoctorProfile.find({ userId: { $in: doctorIds } });
    const doctorUsers = await User.find({ _id: { $in: doctorIds } }).select('name email phone');

    const result = activeLinks.map((link) => {
      const docProf = doctors.find((d) => d.userId.toString() === link.doctorId.toString());
      const docUser = doctorUsers.find((u) => u._id.toString() === link.doctorId.toString());

      return {
        linkId: link._id,
        doctorId: link.doctorId,
        name: docUser?.name || 'Unknown Doctor',
        email: docUser?.email || '',
        phone: docUser?.phone || '',
        specialization: docProf?.specialization || '',
        clinicName: docProf?.clinicName || '',
        city: docProf?.city || '',
        connectedAt: link.respondedAt,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to retrieve connected doctors:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/connections/patients - Get active linked patients for doctor
router.get('/patients', verifyToken, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  const doctorId = req.user!.userId;

  try {
    const activeLinks = await PatientDoctorLink.find({ doctorId, status: 'ACTIVE' });
    const patientIds = activeLinks.map((l) => l.patientId);

    const patients = await PatientProfile.find({ userId: { $in: patientIds } });
    const patientUsers = await User.find({ _id: { $in: patientIds } }).select('name email phone');

    const result = activeLinks.map((link) => {
      const patProf = patients.find((p) => p.userId.toString() === link.patientId.toString());
      const patUser = patientUsers.find((u) => u._id.toString() === link.patientId.toString());

      return {
        linkId: link._id,
        patientId: link.patientId,
        name: patUser?.name || 'Unknown Patient',
        email: patUser?.email || '',
        phone: patUser?.phone || '',
        dateOfBirth: patProf?.dateOfBirth,
        gender: patProf?.gender,
        bloodGroup: patProf?.bloodGroup,
        knownAllergies: patProf?.knownAllergies,
        connectedAt: link.respondedAt,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to retrieve connected patients:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/connections/requests - Get pending requests for doctor
router.get('/requests', verifyToken, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  const doctorId = req.user!.userId;

  try {
    // Also expire any pending requests that have exceeded their expiresAt time right on retrieval
    const now = new Date();
    await PatientDoctorLink.updateMany(
      { doctorId, status: 'PENDING', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } }
    );

    const pendingLinks = await PatientDoctorLink.find({ doctorId, status: 'PENDING', expiresAt: { $gt: now } });
    const patientIds = pendingLinks.map((l) => l.patientId);

    const patientUsers = await User.find({ _id: { $in: patientIds } }).select('name email');

    const result = pendingLinks.map((link) => {
      const patUser = patientUsers.find((u) => u._id.toString() === link.patientId.toString());
      return {
        linkId: link._id,
        patientId: link.patientId,
        name: patUser?.name || 'Unknown Patient',
        email: patUser?.email || '',
        requestedAt: link.requestedAt,
        expiresAt: link.expiresAt,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to retrieve pending request links:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/connections/patient/requests - Get all link history for current patient
router.get('/patient/requests', verifyToken, requireRole('PATIENT'), async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  try {
    const links = await PatientDoctorLink.find({ patientId });
    return res.status(200).json(links);
  } catch (error) {
    console.error('Failed to retrieve patient link requests:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
