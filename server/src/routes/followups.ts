import { Router, type Request, type Response } from 'express';
import verifyToken from '../middleware/auth';
import FollowUp from '../models/FollowUp';

const router = Router();

// GET /api/followups/patient - Retrieve all follow-ups for the logged-in patient (FR-15)
router.get('/patient', verifyToken, async (req: Request, res: Response) => {
  const patientId = req.user!.userId;
  try {
    const followups = await FollowUp.find({ patientId })
      .sort({ scheduledDate: 1 })
      .populate('doctorId', 'name email');

    return res.status(200).json(followups);
  } catch (error) {
    console.error('Failed to retrieve patient follow-ups:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/followups/doctor - Retrieve all follow-ups scheduled by/for the logged-in doctor (FR-15)
router.get('/doctor', verifyToken, async (req: Request, res: Response) => {
  const doctorId = req.user!.userId;
  try {
    const followups = await FollowUp.find({ doctorId })
      .sort({ scheduledDate: 1 })
      .populate('patientId', 'name email');

    return res.status(200).json(followups);
  } catch (error) {
    console.error('Failed to retrieve doctor follow-ups:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/followups/:id/complete - Mark follow-up as complete with notes (FR-15)
router.patch('/:id/complete', verifyToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { completionNotes } = req.body;
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  try {
    const followup = await FollowUp.findById(id);
    if (!followup) {
      return res.status(404).json({ error: 'Follow-up check-in not found' });
    }

    // Authorization safeguard: only the associated patient, doctor, or admin can update it
    if (
      userRole !== 'ADMIN' &&
      followup.patientId.toString() !== userId &&
      followup.doctorId.toString() !== userId
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    followup.completed = true;
    followup.completedAt = new Date();
    followup.completionNotes = completionNotes || '';

    await followup.save();

    return res.status(200).json(followup);
  } catch (error) {
    console.error('Failed to mark follow-up complete:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
