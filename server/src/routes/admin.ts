import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import requireRole from '../middleware/roleGuard';
import DoctorProfile from '../models/DoctorProfile';
import PatientProfile from '../models/PatientProfile';
import User from '../models/User';
import PatientChange from '../models/PatientChange';
import PatientDoctorLink from '../models/PatientDoctorLink';
import Consultation from '../models/Consultation';
import Call from '../models/Call';

const router = Router();

// GET /api/admin/doctors - List all doctors and their profile verification statuses (FR-03)
router.get('/doctors', verifyToken, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const doctors = await DoctorProfile.find();
    
    // Join account details (name, email)
    const doctorsWithNames = await Promise.all(
      doctors.map(async (doc) => {
        const user = await User.findById(doc.userId).select('name email');
        return {
          ...doc.toObject(),
          name: user?.name || 'Unknown Doctor',
          email: user?.email || '',
        };
      })
    );

    return res.status(200).json(doctorsWithNames);
  } catch (error) {
    console.error('Failed to list doctors for admin:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/admin/doctors/:doctorId/verify - Toggle verification flag for a doctor (FR-03)
router.patch('/doctors/:doctorId/verify', verifyToken, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { verified } = req.body;

  if (verified === undefined) {
    return res.status(400).json({ error: 'Verification status (verified: true/false) is required' });
  }

  try {
    const docProfile = await DoctorProfile.findOne({ userId: doctorId });
    if (!docProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    docProfile.verified = verified;
    await docProfile.save();

    return res.status(200).json({ success: true, verified: docProfile.verified });
  } catch (error) {
    console.error('Failed to verify doctor license:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/audit-logs - Retrieve immutable system audit logs (FR-09)
router.get('/audit-logs', verifyToken, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const logs = await PatientChange.find()
      .sort({ changedAt: -1 })
      .populate('patientId', 'name email')
      .populate('changedBy', 'name email');

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Failed to retrieve system audit logs:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/analytics - Retrieve platform-wide metrics (FR-18)
router.get('/analytics', verifyToken, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    // 1. Group users by role
    const usersCount = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const rolesMap: Record<string, number> = { PATIENT: 0, DOCTOR: 0, ADMIN: 0 };
    usersCount.forEach((u) => {
      rolesMap[u._id] = u.count;
    });

    // 2. Count active links, consultations, calls
    const activeConnections = await PatientDoctorLink.countDocuments({ status: 'ACTIVE' });
    const totalConsultations = await Consultation.countDocuments();
    const totalCalls = await Call.countDocuments({ status: 'ENDED' });

    return res.status(200).json({
      totalPatients: rolesMap.PATIENT,
      totalDoctors: rolesMap.DOCTOR,
      totalAdmins: rolesMap.ADMIN,
      activeConnections,
      totalConsultations,
      totalCalls,
    });
  } catch (error) {
    console.error('Failed to compile admin analytics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
