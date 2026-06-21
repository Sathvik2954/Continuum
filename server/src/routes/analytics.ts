import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { Consultation } from '../models/Consultation';
import { Condition } from '../models/Condition';
import { FollowUp } from '../models/FollowUp';
import { Call } from '../models/Call';
import { PatientDoctorLink } from '../models/PatientDoctorLink';
import { User } from '../models/User';
import { DoctorProfile } from '../models/DoctorProfile';

const router = Router();
router.use(verifyToken);

// ─── DOCTOR ANALYTICS ──────────────────────────────────────────────────────────

router.get('/doctor', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.user!.userId);

    const totalPatients = await PatientDoctorLink.countDocuments({ doctorId, status: 'ACTIVE' });

    // Consultations grouped by status
    const consultationsByStatus = await Consultation.aggregate([
      { $match: { doctorId, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Average response time: PATIENT_SUBMITTED createdAt -> DOCTOR_RESPONDED updatedAt
    // Computed via a real MongoDB aggregation pipeline using actual createdAt/updatedAt deltas.
    const avgResponseRes = await Consultation.aggregate([
      {
        $match: {
          doctorId,
          isDeleted: false,
          status: { $in: ['DOCTOR_RESPONDED', 'FOLLOW_UP_PENDING', 'CLOSED'] },
          type: 'ASYNC',
        },
      },
      {
        $project: {
          diffMs: { $subtract: ['$updatedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: '$diffMs' },
        },
      },
    ]);

    let avgResponseHours = 0;
    if (avgResponseRes.length > 0 && avgResponseRes[0].avgMs) {
      avgResponseHours = Math.round((avgResponseRes[0].avgMs / (1000 * 60 * 60)) * 10) / 10;
    }

    // Follow-up completion rate
    const totalFollowUps = await FollowUp.countDocuments({ doctorId });
    const completedFollowUps = await FollowUp.countDocuments({ doctorId, completed: true });
    const followUpCompletionRate = totalFollowUps > 0
      ? Math.round((completedFollowUps / totalFollowUps) * 100)
      : 0;

    // Top 5 conditions across this doctor's patients
    const topConditions = await Condition.aggregate([
      { $match: { addedByDoctorId: doctorId, status: 'ACTIVE' } },
      { $group: { _id: '$conditionName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Call stats
    const totalCalls = await Call.countDocuments({ doctorId, status: 'ENDED' });
    const callDurations = await Call.aggregate([
      { $match: { doctorId, status: 'ENDED', startedAt: { $exists: true }, endedAt: { $exists: true } } },
      {
        $project: {
          durationMin: {
            $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 60000],
          },
        },
      },
      { $group: { _id: null, totalMinutes: { $sum: '$durationMin' } } },
    ]);
    const totalCallMinutes = Math.round(callDurations[0]?.totalMinutes ?? 0);

    res.json({
      totalPatients,
      consultationsByStatus: consultationsByStatus.reduce((acc, c) => {
        acc[c._id] = c.count;
        return acc;
      }, {} as Record<string, number>),
      avgResponseHours,
      followUpCompletionRate,
      topConditions: topConditions.map((c) => ({ name: c._id, count: c.count })),
      totalCalls,
      totalCallMinutes,
    });
  } catch (err) {
    console.error('Doctor analytics error:', err);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// ─── DOCTOR: Export patient list as CSV ───────────────────────────────────────

router.get('/doctor/export', requireRole('DOCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.user!.userId);

    const links = await PatientDoctorLink.find({ doctorId, status: 'ACTIVE' }).lean();

    const rows: string[] = ['Patient Name,Email,Connected Since,Active Conditions'];

    for (const link of links) {
      const patient = await User.findById(link.patientId).select('name email').lean();
      const conditions = await Condition.find({ patientId: link.patientId, status: 'ACTIVE' })
        .select('conditionName')
        .lean();
      const conditionNames = conditions.map((c) => c.conditionName).join('; ');

      rows.push(
        `"${patient?.name ?? ''}","${patient?.email ?? ''}","${new Date(link.respondedAt ?? link.requestedAt).toLocaleDateString('en-IN')}","${conditionNames}"`
      );
    }

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="continuum-patients.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export patient list' });
  }
});

// ─── ADMIN ANALYTICS ───────────────────────────────────────────────────────────

router.get('/admin', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const totalPatients = await User.countDocuments({ role: 'PATIENT' });
    const totalDoctors = await User.countDocuments({ role: 'DOCTOR' });
    const verifiedDoctors = await DoctorProfile.countDocuments({ verified: true });

    // Consultation volume by week (last 8 weeks)
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const volumeByWeek = await Consultation.aggregate([
      { $match: { createdAt: { $gte: eightWeeksAgo }, isDeleted: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%U', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalFollowUps = await FollowUp.countDocuments();
    const completedFollowUps = await FollowUp.countDocuments({ completed: true });
    const platformFollowUpRate = totalFollowUps > 0
      ? Math.round((completedFollowUps / totalFollowUps) * 100)
      : 0;

    const totalCalls = await Call.countDocuments({ status: 'ENDED' });

    res.json({
      totalUsers: totalPatients + totalDoctors,
      totalPatients,
      totalDoctors,
      verifiedDoctors,
      unverifiedDoctors: totalDoctors - verifiedDoctors,
      volumeByWeek: volumeByWeek.map((w) => ({ week: w._id, count: w.count })),
      platformFollowUpRate,
      totalCalls,
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    res.status(500).json({ error: 'Failed to compute admin analytics' });
  }
});

export default router;
