import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { PatientProfile } from '../models/PatientProfile';
import { DoctorProfile } from '../models/DoctorProfile';
import { verifyToken } from '../middleware/auth';

const router = Router();

// ─── REGISTER ────────────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone, role, ...profileData } = req.body;

    // Validate required fields
    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'email, password, name, and role are required' });
      return;
    }

    if (!['PATIENT', 'DOCTOR'].includes(role)) {
      res.status(400).json({ error: 'role must be PATIENT or DOCTOR' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' });
      return;
    }

    // Check email not already used
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      name,
      phone,
    });

    // Create role-specific profile
    if (role === 'DOCTOR') {
      const { specialization, clinicName, city, registrationNumber } = profileData;
      if (!specialization || !clinicName || !city || !registrationNumber) {
        await User.deleteOne({ _id: user._id });
        res.status(400).json({
          error: 'Doctors require: specialization, clinicName, city, registrationNumber',
        });
        return;
      }
      await DoctorProfile.create({
        userId: user._id,
        specialization,
        clinicName,
        city,
        registrationNumber,
        verified: false,
      });
    } else {
      // Patient profile created empty — filled in onboarding
      await PatientProfile.create({ userId: user._id });
    }

    // Issue JWT
    const token = issueToken(user._id.toString(), role, name);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Fetch profile for extra context
    let profileComplete = false;
    if (user.role === 'PATIENT') {
      const profile = await PatientProfile.findOne({ userId: user._id });
      profileComplete = !!(profile?.dateOfBirth && profile?.gender);
    } else if (user.role === 'DOCTOR') {
      const profile = await DoctorProfile.findOne({ userId: user._id });
      profileComplete = !!profile;
    }

    const token = issueToken(user._id.toString(), user.role, user.name);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profileComplete,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── ME (get current user) ───────────────────────────────────────────────────

router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function issueToken(userId: string, role: string, name: string): string {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ userId, role, name }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export default router;
