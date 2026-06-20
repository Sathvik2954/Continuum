import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/auth';
import { DoctorProfile } from '../models/DoctorProfile';
import { User } from '../models/User';

const router = Router();
router.use(verifyToken);

// ─── Search doctors ───────────────────────────────────────────────────────────
// GET /api/doctors/search?q=meera&specialization=cardiology&city=hyderabad

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, specialization, city, page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(20, parseInt(limit as string));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: Record<string, unknown> = {
      verified: true,
      isDeleted: false,
    };

    if (specialization) {
      filter.specialization = { $regex: specialization as string, $options: 'i' };
    }
    if (city) {
      filter.city = { $regex: city as string, $options: 'i' };
    }

    const profiles = await DoctorProfile.find(filter)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get user details for each profile
    let results = await Promise.all(
      profiles.map(async (profile) => {
        const user = await User.findById(profile.userId).select('name email').lean();
        return { ...profile, name: user?.name, email: user?.email };
      })
    );

    // Filter by name query if provided
    if (q) {
      const query = (q as string).toLowerCase();
      results = results.filter(
        (r) =>
          r.name?.toLowerCase().includes(query) ||
          r.specialization?.toLowerCase().includes(query) ||
          r.city?.toLowerCase().includes(query) ||
          r.clinicName?.toLowerCase().includes(query)
      );
    }

    const total = results.length;

    res.json({
      doctors: results,
      pagination: { page: pageNum, limit: limitNum, total },
    });
  } catch (err) {
    console.error('Doctor search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Get single doctor profile ────────────────────────────────────────────────

router.get('/:doctorId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(400).json({ error: 'Invalid doctor ID' });
      return;
    }

    const profile = await DoctorProfile.findOne({
      userId: new mongoose.Types.ObjectId(doctorId),
      verified: true,
      isDeleted: false,
    }).lean();

    if (!profile) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    const user = await User.findById(doctorId).select('name email').lean();

    res.json({ doctor: { ...profile, name: user?.name } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor profile' });
  }
});

export default router;
