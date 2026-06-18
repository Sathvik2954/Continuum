import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import requireRole from '../middleware/roleGuard';
import { checkPatientAccess } from '../middleware/patientAccess';
import PatientProfile from '../models/PatientProfile';
import User from '../models/User';
import logPatientChange from '../middleware/auditTrail';

// Clinical model imports for Timeline query
import Consultation from '../models/Consultation';
import Vital from '../models/Vital';
import Medication from '../models/Medication';
import Condition from '../models/Condition';
import Document from '../models/Document';
import FollowUp from '../models/FollowUp';

const router = Router();

// POST /api/patients/profile - Save or update own patient profile
router.post('/profile', verifyToken, requireRole('PATIENT'), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { dateOfBirth, gender, bloodGroup, knownAllergies, emergencyContactName, emergencyContactPhone } = req.body;

  try {
    let profile = await PatientProfile.findOne({ userId });

    if (!profile) {
      profile = new PatientProfile({
        userId,
        dateOfBirth,
        gender,
        bloodGroup,
        knownAllergies,
        emergencyContactName,
        emergencyContactPhone,
      });
      await profile.save();

      // Write basic audit log entry for initial profile configuration
      await logPatientChange(
        profile._id.toString(),
        'PROFILE',
        profile._id as any,
        {},
        profile.toObject(),
        userId,
        'PATIENT'
      );
    } else {
      // Log differences for updates before saving
      const oldState = profile.toObject();
      
      profile.dateOfBirth = dateOfBirth || profile.dateOfBirth;
      profile.gender = gender || profile.gender;
      profile.bloodGroup = bloodGroup || profile.bloodGroup;
      profile.knownAllergies = knownAllergies !== undefined ? knownAllergies : profile.knownAllergies;
      profile.emergencyContactName = emergencyContactName !== undefined ? emergencyContactName : profile.emergencyContactName;
      profile.emergencyContactPhone = emergencyContactPhone !== undefined ? emergencyContactPhone : profile.emergencyContactPhone;
      
      await profile.save();

      await logPatientChange(
        profile._id.toString(),
        'PROFILE',
        profile._id as any,
        oldState,
        profile.toObject(),
        userId,
        'PATIENT'
      );
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('Patient profile update failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/patients/:patientId/profile - Fetch a patient's full profile
router.get('/:patientId/profile', verifyToken, checkPatientAccess, async (req: Request, res: Response) => {
  const { patientId } = req.params;

  try {
    // Locate the profile of interest
    const profile = await PatientProfile.findOne({ userId: patientId });
    if (!profile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Join account properties (name, email)
    const user = await User.findById(patientId).select('name email phone');
    if (!user) {
      return res.status(404).json({ error: 'Associated user account not found' });
    }

    return res.status(200).json({
      patientId: profile.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      bloodGroup: profile.bloodGroup,
      knownAllergies: profile.knownAllergies,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    console.error('Failed to get patient profile:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/patients/:patientId/timeline - Compile chronological patient health dossier timeline (FR-06)
router.get('/:patientId/timeline', verifyToken, checkPatientAccess, async (req: Request, res: Response) => {
  const { patientId } = req.params;

  try {
    // 1. Fetch from all collections concurrently
    const [
      consultations,
      vitals,
      medications,
      conditions,
      documents,
      followups,
    ] = await Promise.all([
      Consultation.find({ patientId }),
      Vital.find({ patientId }),
      Medication.find({ patientId }),
      Condition.find({ patientId }),
      Document.find({ patientId }),
      FollowUp.find({ patientId }),
    ]);

    // 2. Unify them into a single chronological array
    const timelineEvents: any[] = [];

    consultations.forEach((c) => {
      timelineEvents.push({
        id: c._id,
        eventType: 'CONSULTATION',
        timestamp: c.createdAt,
        title: c.type === 'LIVE_CALL' ? 'Live Call Consultation' : 'Async Symptom Consultation',
        status: c.status,
        priority: c.priority,
        initiatedBy: c.initiatedBy,
        checkinTopic: c.checkinTopic,
        notes: c.patientNotes || c.doctorNotes,
        symptomAudioUrl: c.symptomAudioUrl,
        doctorResponseAudioUrl: c.doctorResponseAudioUrl,
        callRecordingUrl: c.callRecordingUrl,
        followUpDate: c.followUpDate,
        data: c,
      });
    });

    vitals.forEach((v) => {
      timelineEvents.push({
        id: v._id,
        eventType: 'VITAL',
        timestamp: v.recordedAt,
        title: 'Vitals Logged',
        notes: v.notes,
        data: v,
      });
    });

    medications.forEach((m) => {
      timelineEvents.push({
        id: m._id,
        eventType: 'MEDICATION',
        timestamp: m.startDate || m.createdAt,
        title: `Prescribed: ${m.medicineName}`,
        notes: `Dosage: ${m.dosage} · Frequency: ${m.frequency} · Instructions: ${m.instructions}`,
        data: m,
      });
    });

    conditions.forEach((cond) => {
      timelineEvents.push({
        id: cond._id,
        eventType: 'CONDITION',
        timestamp: cond.diagnosedOn || cond.createdAt,
        title: `Diagnosed Condition: ${cond.conditionName}`,
        notes: `Severity: ${cond.notes || cond.severity} · Status: ${cond.status}`,
        data: cond,
      });
    });

    documents.forEach((d) => {
      timelineEvents.push({
        id: d._id,
        eventType: 'DOCUMENT',
        timestamp: d.uploadedAt,
        title: `Document Uploaded: ${d.documentType.replace('_', ' ')}`,
        notes: `${d.fileName} (${d.fileSizeKb ? d.fileSizeKb + ' KB' : 'Size unknown'})`,
        fileUrl: d.fileUrl,
        data: d,
      });
    });

    followups.forEach((f) => {
      timelineEvents.push({
        id: f._id,
        eventType: 'FOLLOWUP',
        timestamp: f.scheduledDate,
        title: `Follow-up Checkpoint (${f.type.replace('_', ' ')})`,
        notes: f.notes,
        status: f.completed ? 'COMPLETED' : 'PENDING',
        completedAt: f.completedAt,
        completionNotes: f.completionNotes,
        data: f,
      });
    });

    // Sort newest first
    timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json(timelineEvents);
  } catch (error) {
    console.error('Failed to compile health timeline:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
