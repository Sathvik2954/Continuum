import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import PatientProfile from '../models/PatientProfile';
import Consultation from '../models/Consultation';
import Vital from '../models/Vital';
import Document from '../models/Document';
import FollowUp from '../models/FollowUp';
import logPatientChange from '../middleware/auditTrail';

const router = Router();

// POST /api/sync - Process an offline sync item
router.post('/', verifyToken, async (req: Request, res: Response) => {
  const { id, type, data } = req.body;
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!id || !type || !data) {
    return res.status(400).json({ error: 'Sync parameters (id, type, data) are required' });
  }

  try {
    const clientUpdatedAt = new Date(data.updatedAt || Date.now());

    switch (type) {
      case 'patient_profile': {
        // Patient profiles map 1-to-1 to the userId
        let profile = await PatientProfile.findOne({ userId });
        
        if (profile) {
          // Check for conflicts
          if (clientUpdatedAt < profile.updatedAt) {
            return res.status(409).json({
              error: 'Conflict: Server has a newer version of patient profile.',
              serverVersion: profile,
            });
          }
          
          const oldState = profile.toObject();
          // Update properties
          profile.dateOfBirth = data.dateOfBirth || profile.dateOfBirth;
          profile.gender = data.gender || profile.gender;
          profile.bloodGroup = data.bloodGroup || profile.bloodGroup;
          profile.knownAllergies = data.knownAllergies !== undefined ? data.knownAllergies : profile.knownAllergies;
          profile.emergencyContactName = data.emergencyContactName !== undefined ? data.emergencyContactName : profile.emergencyContactName;
          profile.emergencyContactPhone = data.emergencyContactPhone !== undefined ? data.emergencyContactPhone : profile.emergencyContactPhone;
          
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

          return res.status(200).json({ success: true, record: profile });
        } else {
          // Profile doesn't exist, create it
          profile = new PatientProfile({
            userId,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            bloodGroup: data.bloodGroup,
            knownAllergies: data.knownAllergies,
            emergencyContactName: data.emergencyContactName,
            emergencyContactPhone: data.emergencyContactPhone,
          });
          await profile.save();

          await logPatientChange(
            profile._id.toString(),
            'PROFILE',
            profile._id as any,
            {},
            profile.toObject(),
            userId,
            'PATIENT'
          );

          return res.status(200).json({ success: true, record: profile });
        }
      }

      case 'consultation': {
        // Consultations are keyed by UUID client generated ID
        let consultation = await Consultation.findById(id);

        if (consultation) {
          if (clientUpdatedAt < consultation.updatedAt) {
            return res.status(409).json({
              error: 'Conflict: Server has a newer version of this consultation.',
              serverVersion: consultation,
            });
          }

          const oldState = consultation.toObject();
          // Merge client data
          consultation.status = data.status || consultation.status;
          consultation.symptomsChecklist = data.symptomsChecklist || consultation.symptomsChecklist;
          consultation.patientNotes = data.patientNotes || consultation.patientNotes;
          consultation.symptomAudioUrl = data.symptomAudioUrl || consultation.symptomAudioUrl;
          consultation.doctorResponseAudioUrl = data.doctorResponseAudioUrl || consultation.doctorResponseAudioUrl;
          consultation.doctorNotes = data.doctorNotes || consultation.doctorNotes;
          consultation.followUpDate = data.followUpDate || consultation.followUpDate;

          await consultation.save();

          await logPatientChange(
            consultation.patientId.toString(),
            'CONSULTATION',
            consultation._id as any,
            oldState,
            consultation.toObject(),
            userId,
            userRole
          );

          return res.status(200).json({ success: true, record: consultation });
        } else {
          // Validate required fields for new consultation
          if (!data.doctorId || !data.type) {
            return res.status(400).json({ error: 'Missing required consultation properties (doctorId, type)' });
          }

          consultation = new Consultation({
            _id: id,
            patientId: userId, // The syncing patient
            doctorId: data.doctorId,
            type: data.type,
            initiatedBy: 'PATIENT',
            priority: data.priority || 'NORMAL',
            status: data.status || 'PATIENT_SUBMITTED',
            symptomsChecklist: data.symptomsChecklist,
            patientNotes: data.patientNotes,
            symptomAudioUrl: data.symptomAudioUrl,
          });

          await consultation.save();

          await logPatientChange(
            userId,
            'CONSULTATION',
            consultation._id as any,
            {},
            consultation.toObject(),
            userId,
            'PATIENT'
          );

          return res.status(200).json({ success: true, record: consultation });
        }
      }

      case 'vitals': {
        // Vitals log entries are time-series data and typically immutable additions
        let vital = await Vital.findById(id);

        if (!vital) {
          vital = new Vital({
            _id: id,
            patientId: userId,
            recordedAt: data.recordedAt || Date.now(),
            bpSystolic: data.bpSystolic,
            bpDiastolic: data.bpDiastolic,
            bloodGlucoseFasting: data.bloodGlucoseFasting,
            bloodGlucosePostMeal: data.bloodGlucosePostMeal,
            weightKg: data.weightKg,
            heartRate: data.heartRate,
            notes: data.notes,
          });
          await vital.save();
        }

        return res.status(200).json({ success: true, record: vital });
      }

      case 'followup_completion': {
        // Marking follow up completed offline
        const followup = await FollowUp.findById(id);
        if (!followup) {
          return res.status(404).json({ error: 'FollowUp not found' });
        }

        if (followup.completed) {
          // Already completed on server, ignore or resolve
          return res.status(200).json({ success: true, record: followup });
        }

        followup.completed = true;
        followup.completedAt = data.completedAt || new Date();
        followup.completionNotes = data.completionNotes || '';
        await followup.save();

        return res.status(200).json({ success: true, record: followup });
      }

      case 'document': {
        let document = await Document.findById(id);

        if (!document) {
          document = new Document({
            _id: id,
            patientId: userId,
            consultationId: data.consultationId,
            uploadedBy: userId,
            documentType: data.documentType,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSizeKb: data.fileSizeKb,
          });
          await document.save();
        }

        return res.status(200).json({ success: true, record: document });
      }

      case 'call_recording': {
        // Append client recording to a live call consultation
        let consultation = await Consultation.findById(id);
        if (!consultation) {
          return res.status(404).json({ error: 'Associated live call consultation not found' });
        }

        consultation.callRecordingUrl = data.callRecordingUrl;
        consultation.callRecordingUploadStatus = 'UPLOADED';
        consultation.status = 'RECORDED';
        await consultation.save();

        return res.status(200).json({ success: true, record: consultation });
      }

      default:
        return res.status(400).json({ error: `Unsupported sync type: ${type}` });
    }
  } catch (error) {
    console.error('Database Sync handling failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
