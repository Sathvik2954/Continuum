import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import requireRole from '../middleware/roleGuard';
import DoctorProfile from '../models/DoctorProfile';
import User from '../models/User';
import PatientDoctorLink from '../models/PatientDoctorLink';
import Consultation from '../models/Consultation';
import { Types } from 'mongoose';

const router = Router();

// GET /api/doctors/search - Search verified doctors by name, specialization, or city
router.get('/search', verifyToken, async (req: Request, res: Response) => {
  const { name, specialization, city } = req.query;

  try {
    const matchStage: any = {
      isDeleted: false,
      verified: true, // Only show verified doctors to patients (FR-03)
    };

    if (specialization) {
      matchStage.specialization = { $regex: String(specialization), $options: 'i' };
    }
    if (city) {
      matchStage.city = { $regex: String(city), $options: 'i' };
    }

    const nameFilter: any = {};
    if (name) {
      nameFilter['user.name'] = { $regex: String(name), $options: 'i' };
    }

    const aggregatePipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ];

    if (name) {
      aggregatePipeline.push({ $match: nameFilter });
    }

    aggregatePipeline.push({
      $project: {
        _id: 0,
        doctorId: '$userId',
        specialization: 1,
        clinicName: 1,
        city: 1,
        registrationNumber: 1,
        verified: 1,
        name: '$user.name',
        email: '$user.email',
      },
    });

    const doctors = await DoctorProfile.aggregate(aggregatePipeline);
    return res.status(200).json(doctors);
  } catch (error) {
    console.error('Doctor search failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/doctors/profile - Create or update doctor profile configuration
router.post('/profile', verifyToken, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { specialization, clinicName, city, registrationNumber } = req.body;

  if (!specialization || !clinicName || !city || !registrationNumber) {
    return res.status(400).json({ error: 'All profile configuration fields are required' });
  }

  try {
    let profile = await DoctorProfile.findOne({ userId });

    if (!profile) {
      profile = new DoctorProfile({
        userId,
        specialization,
        clinicName,
        city,
        registrationNumber,
        verified: false, // Must be verified by admin
      });
    } else {
      profile.specialization = specialization;
      profile.clinicName = clinicName;
      profile.city = city;
      profile.registrationNumber = registrationNumber;
    }

    await profile.save();
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Doctor profile configuration failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/doctors/:doctorId/profile - Retrieve details of a doctor profile
router.get('/:doctorId/profile', verifyToken, async (req: Request, res: Response) => {
  const { doctorId } = req.params;

  try {
    const profile = await DoctorProfile.findOne({ userId: doctorId });
    if (!profile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const user = await User.findById(doctorId).select('name email phone');
    if (!user) {
      return res.status(404).json({ error: 'Associated user account not found' });
    }

    return res.status(200).json({
      doctorId: profile.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      specialization: profile.specialization,
      clinicName: profile.clinicName,
      city: profile.city,
      registrationNumber: profile.registrationNumber,
      verified: profile.verified,
    });
  } catch (error) {
    console.error('Failed to get doctor profile:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/doctors/:doctorId/analytics - Retrieve doctor practice analytics (FR-18)
router.get('/:doctorId/analytics', verifyToken, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const requesterId = req.user!.userId;
  const requesterRole = req.user!.role;

  if (requesterRole !== 'ADMIN' && requesterId !== doctorId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    // 1. Total connected patients
    const totalConnectedPatients = await PatientDoctorLink.countDocuments({
      doctorId,
      status: 'ACTIVE',
    });

    // 2. Consultation priority counts
    const priorityCountsAgg = await Consultation.aggregate([
      { $match: { doctorId: new Types.ObjectId(doctorId), isDeleted: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    const priorityCounts = { NORMAL: 0, HIGH: 0, URGENT: 0 };
    priorityCountsAgg.forEach((item) => {
      if (item._id in priorityCounts) {
        priorityCounts[item._id as keyof typeof priorityCounts] = item.count;
      }
    });

    // 3. Closed vs Open consultation distribution
    const statusCountsAgg = await Consultation.aggregate([
      { $match: { doctorId: new Types.ObjectId(doctorId), isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    let openCount = 0;
    let closedCount = 0;
    statusCountsAgg.forEach((item) => {
      if (item._id === 'CLOSED' || item._id === 'ENDED') {
        closedCount += item.count;
      } else {
        openCount += item.count;
      }
    });

    // 4. Average response time for ASYNC consultations
    const avgResponseTimeAgg = await Consultation.aggregate([
      {
        $match: {
          doctorId: new Types.ObjectId(doctorId),
          type: 'ASYNC',
          status: { $in: ['DOCTOR_RESPONDED', 'CLOSED'] },
          isDeleted: false,
        },
      },
      {
        $project: {
          responseTimeMs: { $subtract: ['$updatedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTimeMs: { $avg: '$responseTimeMs' },
        },
      },
    ]);

    const avgResponseTimeMinutes = avgResponseTimeAgg.length > 0 
      ? Math.round(avgResponseTimeAgg[0].avgResponseTimeMs / 1000 / 60)
      : 0;

    return res.status(200).json({
      totalConnectedPatients,
      priorityCounts,
      distribution: {
        open: openCount,
        closed: closedCount,
      },
      avgResponseTimeMinutes,
    });
  } catch (error) {
    console.error('Failed to retrieve doctor analytics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
