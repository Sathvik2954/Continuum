import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import { checkPatientAccess } from '../middleware/patientAccess';
import Call from '../models/Call';
import Consultation from '../models/Consultation';
import PatientDoctorLink from '../models/PatientDoctorLink';
import User from '../models/User';
import DoctorProfile from '../models/DoctorProfile';
import logPatientChange from '../middleware/auditTrail';

const router = Router();

// POST /api/calls - Schedule a live call consultation (FR-33)
router.post('/', verifyToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { patientId, doctorId, scheduledAt, estimatedDurationMin, preCallNotes } = req.body;

  // Enforce correct target ids depending on who schedules
  const targetPatientId = role === 'PATIENT' ? userId : patientId;
  const targetDoctorId = role === 'DOCTOR' ? userId : doctorId;

  if (!targetPatientId || !targetDoctorId || !scheduledAt || !estimatedDurationMin) {
    return res.status(400).json({ error: 'Missing required parameters (patientId, doctorId, scheduledAt, estimatedDurationMin)' });
  }

  try {
    // 1. Assert ACTIVE link relationship exists
    const link = await PatientDoctorLink.findOne({
      patientId: targetPatientId,
      doctorId: targetDoctorId,
      status: 'ACTIVE',
    });
    
    if (!link) {
      return res.status(403).json({ error: 'Forbidden: You must have an ACTIVE link to schedule live calls' });
    }

    // 2. Create placeholder Consultation of type LIVE_CALL so it reflects in chronological timelines
    const consultation = new Consultation({
      patientId: targetPatientId,
      doctorId: targetDoctorId,
      type: 'LIVE_CALL',
      initiatedBy: role,
      priority: 'NORMAL',
      status: 'SCHEDULED',
      callScheduledAt: new Date(scheduledAt),
    });
    await consultation.save();

    // 3. Create Call record
    const call = new Call({
      patientId: targetPatientId,
      doctorId: targetDoctorId,
      scheduledBy: role,
      scheduledAt: new Date(scheduledAt),
      estimatedDurationMin,
      preCallNotes,
      status: 'SCHEDULED',
      consultationId: consultation._id,
    });
    await call.save();

    // Log patient audit trail
    await logPatientChange(
      targetPatientId,
      'CONSULTATION',
      consultation._id as any,
      {},
      consultation.toObject(),
      userId,
      role
    );

    return res.status(201).json(call);
  } catch (error) {
    console.error('Failed to schedule live call:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/calls - List upcoming and active live calls for the user
router.get('/', verifyToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    let calls = [];
    const filterStatus = { $in: ['SCHEDULED', 'CONFIRMED', 'PATIENT_JOINED', 'DOCTOR_JOINED', 'ACTIVE'] };

    if (role === 'PATIENT') {
      // Fetch and populate doctor details
      calls = await Call.find({ patientId: userId, status: filterStatus }).sort({ scheduledAt: 1 });
      
      const callsWithDetails = await Promise.all(
        calls.map(async (c) => {
          const docUser = await User.findById(c.doctorId).select('name email');
          const docProfile = await DoctorProfile.findOne({ userId: c.doctorId }).select('specialization clinicName');
          return {
            ...c.toObject(),
            doctorName: docUser?.name || 'Unknown Doctor',
            doctorEmail: docUser?.email || '',
            specialization: docProfile?.specialization || '',
            clinicName: docProfile?.clinicName || '',
          };
        })
      );
      return res.status(200).json(callsWithDetails);
    } else if (role === 'DOCTOR') {
      // Fetch and populate patient details
      calls = await Call.find({ doctorId: userId, status: filterStatus }).sort({ scheduledAt: 1 });
      
      const callsWithDetails = await Promise.all(
        calls.map(async (c) => {
          const patUser = await User.findById(c.patientId).select('name email');
          return {
            ...c.toObject(),
            patientName: patUser?.name || 'Unknown Patient',
            patientEmail: patUser?.email || '',
          };
        })
      );
      return res.status(200).json(callsWithDetails);
    }

    return res.status(400).json({ error: 'Unsupported system role' });
  } catch (error) {
    console.error('Failed to list live calls:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/calls/:id/status - Update call state and sync status on the Consultation record
router.patch('/:id/status', verifyToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (!status) {
    return res.status(400).json({ error: 'Call status is required' });
  }

  try {
    const call = await Call.findById(id);
    if (!call) {
      return res.status(404).json({ error: 'Call record not found' });
    }

    // Validate authorization
    if (call.patientId.toString() !== userId && call.doctorId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    call.status = status;
    await call.save();

    // Sync status change directly into the timeline Consultation record
    if (call.consultationId) {
      const consultation = await Consultation.findById(call.consultationId);
      if (consultation) {
        const oldState = consultation.toObject();
        
        consultation.status = status;
        
        if (status === 'ACTIVE' && !consultation.callStartedAt) {
          consultation.callStartedAt = new Date();
        } else if (status === 'ENDED') {
          consultation.callEndedAt = new Date();
          if (consultation.callStartedAt) {
            consultation.callDurationSeconds = Math.round(
              (consultation.callEndedAt.getTime() - consultation.callStartedAt.getTime()) / 1000
            );
          }
        }
        
        await consultation.save();

        await logPatientChange(
          call.patientId.toString(),
          'CONSULTATION',
          consultation._id as any,
          oldState,
          consultation.toObject(),
          userId,
          role
        );
      }
    }

    return res.status(200).json(call);
  } catch (error) {
    console.error('Failed to update call status:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
