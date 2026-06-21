import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/auth';
import { callRecordingUpload } from '../middleware/uploadCallRecording';
import { Call } from '../models/Call';
import { PatientDoctorLink } from '../models/PatientDoctorLink';
import { Consultation } from '../models/Consultation';

const router = Router();
router.use(verifyToken);

// ─── Schedule a call (either party can initiate) ──────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const { counterpartId, scheduledAt, estimatedDurationMin, preCallNotes } = req.body;

    if (!counterpartId || !scheduledAt) {
      res.status(400).json({ error: 'counterpartId and scheduledAt are required' });
      return;
    }

    const patientId = role === 'PATIENT' ? userId : counterpartId;
    const doctorId = role === 'DOCTOR' ? userId : counterpartId;

    const link = await PatientDoctorLink.findOne({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: 'ACTIVE',
    });

    if (!link) {
      res.status(403).json({ error: 'You must be connected to schedule a call' });
      return;
    }

    const call = await Call.create({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: new mongoose.Types.ObjectId(doctorId),
      scheduledBy: role,
      scheduledAt: new Date(scheduledAt),
      estimatedDurationMin: estimatedDurationMin || 15,
      preCallNotes,
      status: 'SCHEDULED',
    });

    res.status(201).json({ call });
  } catch (err) {
    console.error('Schedule call error:', err);
    res.status(500).json({ error: 'Failed to schedule call' });
  }
});

router.patch('/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const call = await Call.findById(req.params.id);
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    
    const isParticipant = call.patientId.toString() === userId || call.doctorId.toString() === userId;
    if (!isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    if (role === 'DOCTOR') {
      const link = await PatientDoctorLink.findOne({
        patientId: call.patientId,
        doctorId: new mongoose.Types.ObjectId(userId),
        status: 'ACTIVE',
      });
      if (!link) {
        res.status(403).json({ error: 'Access denied — no active connection with this patient' });
        return;
      }
    }

    call.status = 'CONFIRMED';
    await call.save();
    res.json({ call });
  } catch {
    res.status(500).json({ error: 'Failed to confirm call' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const filter = role === 'PATIENT'
      ? { patientId: new mongoose.Types.ObjectId(userId) }
      : { doctorId: new mongoose.Types.ObjectId(userId) };
    const calls = await Call.find(filter)
      .populate('patientId', 'name')
      .populate('doctorId', 'name')
      .sort({ scheduledAt: -1 });
    res.json({ calls });
  } catch {
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const call = await Call.findById(req.params.id);
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    
    const isParticipant = call.patientId.toString() === userId || call.doctorId.toString() === userId;
    if (!isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    if (role === 'DOCTOR') {
      const link = await PatientDoctorLink.findOne({
        patientId: call.patientId,
        doctorId: new mongoose.Types.ObjectId(userId),
        status: 'ACTIVE',
      });
      if (!link) {
        res.status(403).json({ error: 'Access denied — no active connection with this patient' });
        return;
      }
    }

    res.json({ call });
  } catch {
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

// ─── Get ICE server config — fetches LIVE short-lived TURN credentials
//     from Xirsys on every request. Never caches the secret on the client. ────

interface XirsysIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface XirsysResponse {
  v?: {
    iceServers?: XirsysIceServer;
  };
}

router.get('/:id/ice-config', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const call = await Call.findById(req.params.id);
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }

    const isParticipant = call.patientId.toString() === userId || call.doctorId.toString() === userId;
    if (!isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    if (role === 'DOCTOR') {
      const link = await PatientDoctorLink.findOne({
        patientId: call.patientId,
        doctorId: new mongoose.Types.ObjectId(userId),
        status: 'ACTIVE',
      });
      if (!link) {
        res.status(403).json({ error: 'Access denied — no active connection with this patient' });
        return;
      }
    }

    const ident = process.env.XIRSYS_IDENT;
    const secret = process.env.XIRSYS_SECRET;
    const channel = process.env.XIRSYS_CHANNEL;

    const iceServers: XirsysIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
    ];

    if (ident && secret && channel) {
      try {
        const xirsysRes = await fetch(`https://global.xirsys.net/_turn/${channel}`, {
          method: 'PUT',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${ident}:${secret}`).toString('base64'),
            'Content-Type': 'application/json',
          },
        });

        if (xirsysRes.ok) {
          const data = (await xirsysRes.json()) as XirsysResponse;
          const xirsysIceServer: XirsysIceServer | undefined = data?.v?.iceServers;
          if (xirsysIceServer) {
            iceServers.push({
              urls: xirsysIceServer.urls,
              username: xirsysIceServer.username,
              credential: xirsysIceServer.credential,
            });
          }
        } else {
          console.warn('⚠️  Xirsys request failed:', xirsysRes.status, await xirsysRes.text());
        }
      } catch (xirsysErr) {
        console.error('Xirsys fetch error:', xirsysErr);
        // Fall through — STUN-only is better than nothing
      }
    } else {
      console.warn('⚠️  XIRSYS_IDENT / XIRSYS_SECRET / XIRSYS_CHANNEL not set — using STUN-only (calls may fail behind strict NAT)');
    }

    res.json({ iceServers });
  } catch (err) {
    console.error('ICE config error:', err);
    res.status(500).json({ error: 'Failed to fetch ICE configuration' });
  }
});

router.patch('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const call = await Call.findById(req.params.id);
    if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
    
    const isParticipant = call.patientId.toString() === userId || call.doctorId.toString() === userId;
    if (!isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    if (role === 'DOCTOR') {
      const link = await PatientDoctorLink.findOne({
        patientId: call.patientId,
        doctorId: new mongoose.Types.ObjectId(userId),
        status: 'ACTIVE',
      });
      if (!link) {
        res.status(403).json({ error: 'Access denied — no active connection with this patient' });
        return;
      }
    }

    if (['ACTIVE', 'ENDED'].includes(call.status)) {
      res.status(400).json({ error: 'Cannot cancel a call that is in progress or has ended' });
      return;
    }
    call.status = 'CANCELLED';
    await call.save();
    res.json({ call });
  } catch {
    res.status(500).json({ error: 'Failed to cancel call' });
  }
});

// ─── Upload call recording — patient's device records audio during the call,
//     uploads it after hangup, server creates a LIVE_CALL consultation ────────

router.post(
  '/:id/recording',
  callRecordingUpload.single('recording'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.user!;
      const { id } = req.params;

      const call = await Call.findById(id);
      if (!call) { res.status(404).json({ error: 'Call not found' }); return; }

      const isParticipant = call.patientId.toString() === userId || call.doctorId.toString() === userId;
      if (!isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

      if (role === 'DOCTOR') {
        const link = await PatientDoctorLink.findOne({
          patientId: call.patientId,
          doctorId: new mongoose.Types.ObjectId(userId),
          status: 'ACTIVE',
        });
        if (!link) {
          res.status(403).json({ error: 'Access denied — no active connection with this patient' });
          return;
        }
      }

      if (!req.file) {
        res.status(400).json({ error: 'No recording file uploaded' });
        return;
      }

      const recordingUrl = `/uploads/calls/${req.file.filename}`;
      const durationSeconds = call.startedAt
        ? Math.round((Date.now() - call.startedAt.getTime()) / 1000)
        : undefined;

      // Create the LIVE_CALL consultation — this is what makes the call
      // show up on the patient's health timeline, same as an async one.
      const consultation = await Consultation.create({
        patientId: call.patientId,
        doctorId: call.doctorId,
        type: 'LIVE_CALL',
        initiatedBy: call.scheduledBy,
        priority: 'NORMAL',
        status: 'DOCTOR_RESPONDED', // live calls are considered "responded" immediately — the conversation already happened
        doctorResponseAudioUrl: recordingUrl,
        doctorNotes: call.preCallNotes,
        callDurationSeconds: durationSeconds,
      });

      call.consultationId = consultation._id;
      if (call.status !== 'ENDED') {
        call.status = 'ENDED';
        call.endedAt = new Date();
      }
      await call.save();

      res.status(201).json({ consultation, call });
    } catch (err) {
      console.error('Recording upload error:', err);
      res.status(500).json({ error: 'Failed to save call recording' });
    }
  }
);

export default router;
