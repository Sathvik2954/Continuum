import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import requireRole from '../middleware/roleGuard';
import { checkPatientAccess } from '../middleware/patientAccess';
import Consultation from '../models/Consultation';
import PatientDoctorLink from '../models/PatientDoctorLink';
import Medication from '../models/Medication';
import Condition from '../models/Condition';
import FollowUp from '../models/FollowUp';
import logPatientChange from '../middleware/auditTrail';
import User from '../models/User';

const router = Router();

// State Machine status validation helper
function isValidTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    'PATIENT_SUBMITTED': ['DOCTOR_REVIEWING', 'DOCTOR_RESPONDED'],
    'DOCTOR_REVIEWING': ['DOCTOR_RESPONDED', 'CLOSED'],
    'DOCTOR_RESPONDED': ['FOLLOW_UP_PENDING', 'CLOSED'],
    'FOLLOW_UP_PENDING': ['CLOSED'],
    'DOCTOR_CHECKIN': ['PATIENT_RESPONDED', 'CLOSED'],
    'PATIENT_RESPONDED': ['DOCTOR_REVIEWING', 'DOCTOR_RESPONDED'],
    'CLOSED': [] // Terminal state
  };

  return (transitions[from] || []).includes(to);
}

// POST /api/consultations - Patient starts a new async consultation (FR-12, FR-13)
router.post('/', verifyToken, requireRole('PATIENT'), async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  const { doctorId, priority, symptomsChecklist, patientNotes, symptomAudioUrl } = req.body;

  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor ID is required to initiate consultation' });
  }

  try {
    // Confirm patient is connected to doctor
    const link = await PatientDoctorLink.findOne({ patientId, doctorId, status: 'ACTIVE' });
    if (!link) {
      return res.status(403).json({ error: 'Forbidden: You must have an ACTIVE connection to this doctor' });
    }

    const consultation = new Consultation({
      patientId,
      doctorId,
      type: 'ASYNC',
      initiatedBy: 'PATIENT',
      priority: priority || 'NORMAL',
      status: 'PATIENT_SUBMITTED',
      symptomsChecklist,
      patientNotes,
      symptomAudioUrl,
    });

    await consultation.save();

    await logPatientChange(
      patientId,
      'CONSULTATION',
      consultation._id as any,
      {},
      consultation.toObject(),
      patientId,
      'PATIENT'
    );

    return res.status(201).json(consultation);
  } catch (error) {
    console.error('Failed to create consultation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/consultations - List consultations for the logged-in user (FR-15, FR-16)
router.get('/', verifyToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    let consultations: any[] = [];

    if (role === 'PATIENT') {
      consultations = await Consultation.find({ patientId: userId }).sort({ createdAt: -1 });
    } else if (role === 'DOCTOR') {
      // Sort by URGENT priority first, then HIGH, then NORMAL, and order chronologically (FR-16)
      consultations = await Consultation.find({ doctorId: userId }).populate('patientId', 'name email');
      
      const priorityWeights: Record<string, number> = { URGENT: 3, HIGH: 2, NORMAL: 1 };
      consultations.sort((a, b) => {
        const weightA = priorityWeights[a.priority] || 1;
        const weightB = priorityWeights[b.priority] || 1;
        if (weightA !== weightB) {
          return weightB - weightA; // Higher weight first
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest first
      });
    }

    return res.status(200).json(consultations);
  } catch (error) {
    console.error('Failed to list consultations:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/consultations/:id - Retrieve consultation details
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Assert relationship access
    const hasAccess = (consultation.patientId.toString() === userId) || 
      (consultation.doctorId.toString() === userId && role === 'DOCTOR');
      
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this consultation record' });
    }

    // Retrieve associated medications prescribed in this consultation
    const medications = await Medication.find({ consultationId: id });

    // Retrieve conditions added/modified in this consultation
    const conditions = await Condition.find({ consultationId: id });

    // Join patient user account name
    const patientUser = await User.findById(consultation.patientId).select('name');

    return res.status(200).json({
      consultation,
      patientName: patientUser?.name || 'Unknown Patient',
      medications,
      conditions,
    });
  } catch (error) {
    console.error('Failed to get consultation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/consultations/:id/status - Update consultation status (state validation check)
router.patch('/:id/status', verifyToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user!.userId;

  if (!status) {
    return res.status(400).json({ error: 'New status is required' });
  }

  try {
    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Verify authorized doctor or patient is editing
    const isPatient = consultation.patientId.toString() === userId;
    const isDoctor = consultation.doctorId.toString() === userId;

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // State machine check (FR-24)
    if (!isValidTransition(consultation.status, status)) {
      return res.status(400).json({
        error: `Invalid status transition: Cannot move from ${consultation.status} to ${status}`
      });
    }

    const oldState = consultation.toObject();
    consultation.status = status;
    await consultation.save();

    await logPatientChange(
      consultation.patientId.toString(),
      'CONSULTATION',
      consultation._id as any,
      oldState,
      consultation.toObject(),
      userId,
      req.user!.role
    );

    return res.status(200).json(consultation);
  } catch (error) {
    console.error('Failed to update status:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/consultations/:id/respond - Doctor submits a response (meds + audio) (FR-21 to FR-25)
router.post('/:id/respond', verifyToken, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  const doctorId = req.user!.userId;
  const { id } = req.params;
  const { doctorNotes, doctorResponseAudioUrl, medications, followUpDate, chronicConditions } = req.body;

  try {
    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    if (consultation.doctorId.toString() !== doctorId) {
      return res.status(403).json({ error: 'Forbidden: You are not the assigned doctor for this consultation' });
    }

    const oldState = consultation.toObject();

    // 1. Save doctor response details
    consultation.doctorNotes = doctorNotes;
    consultation.doctorResponseAudioUrl = doctorResponseAudioUrl;
    consultation.followUpDate = followUpDate ? new Date(followUpDate) : undefined;
    consultation.status = 'DOCTOR_RESPONDED';
    await consultation.save();

    // 2. Prescribe medications if array exists (FR-46)
    if (Array.isArray(medications) && medications.length > 0) {
      const medicationDocs = medications.map((med: any) => ({
        consultationId: id,
        patientId: consultation.patientId,
        prescribedByDoctorId: doctorId,
        medicineName: med.medicineName,
        dosage: med.dosage,
        frequency: med.frequency,
        durationDays: med.durationDays,
        instructions: med.instructions || '',
        startDate: med.startDate || new Date(),
      }));
      await Medication.insertMany(medicationDocs);
    }

    // 3. Update or diagnosed chronic conditions if array exists (FR-44)
    if (Array.isArray(chronicConditions) && chronicConditions.length > 0) {
      for (const cond of chronicConditions) {
        let condition = await Condition.findOne({
          patientId: consultation.patientId,
          conditionName: cond.conditionName
        });

        if (condition) {
          condition.severity = cond.severity;
          condition.status = cond.status;
          condition.notes = cond.notes || condition.notes;
          condition.consultationId = id as any;
          await condition.save();
        } else {
          condition = new Condition({
            patientId: consultation.patientId,
            addedByDoctorId: doctorId,
            consultationId: id,
            conditionName: cond.conditionName,
            severity: cond.severity || 'MILD',
            diagnosedOn: cond.diagnosedOn || new Date(),
            status: cond.status || 'ACTIVE',
            notes: cond.notes || '',
          });
          await condition.save();
        }
      }
    }

    // 4. Create FollowUp task if followUpDate exists (FR-54)
    if (followUpDate) {
      const followup = new FollowUp({
        consultationId: id,
        patientId: consultation.patientId,
        doctorId,
        scheduledDate: new Date(followUpDate),
        type: 'AUDIO_CHECKIN', // default for async response followups
        notes: `Follow-up scheduled from async consultation response.`,
        completed: false,
      });
      await followup.save();
    }

    // Write audit log
    await logPatientChange(
      consultation.patientId.toString(),
      'CONSULTATION',
      consultation._id as any,
      oldState,
      consultation.toObject(),
      doctorId,
      'DOCTOR'
    );

    return res.status(200).json({ success: true, consultation });
  } catch (error) {
    console.error('Failed to submit consultation response:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/consultations/checkin - Doctor initiates a patient check-in (FR-17)
router.post('/checkin', verifyToken, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  const doctorId = req.user!.userId;
  const { patientId, checkinTopic, doctorNotes, dueDate } = req.body;

  if (!patientId || !checkinTopic) {
    return res.status(400).json({ error: 'Patient ID and checkin topic are required' });
  }

  try {
    // Confirm ACTIVE relationship link
    const link = await PatientDoctorLink.findOne({ patientId, doctorId, status: 'ACTIVE' });
    if (!link) {
      return res.status(403).json({ error: 'Forbidden: You must have an ACTIVE connection to initiate check-ins' });
    }

    const consultation = new Consultation({
      patientId,
      doctorId,
      type: 'ASYNC',
      initiatedBy: 'DOCTOR',
      priority: 'NORMAL',
      status: 'DOCTOR_CHECKIN',
      checkinTopic,
      doctorNotes, // Initial check-in instructions from doctor
    });

    await consultation.save();

    // Create a follow up check if dueDate provided
    if (dueDate) {
      const followup = new FollowUp({
        consultationId: consultation._id,
        patientId,
        doctorId,
        scheduledDate: new Date(dueDate),
        type: 'VITALS_CHECK',
        notes: `Vitals check-in topic: ${checkinTopic}`,
        completed: false,
      });
      await followup.save();
    }

    await logPatientChange(
      patientId,
      'CONSULTATION',
      consultation._id as any,
      {},
      consultation.toObject(),
      doctorId,
      'DOCTOR'
    );

    return res.status(201).json(consultation);
  } catch (error) {
    console.error('Failed to initiate check-in:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
