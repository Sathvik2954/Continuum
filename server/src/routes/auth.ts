import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import PatientProfile from '../models/PatientProfile';
import DoctorProfile from '../models/DoctorProfile';

const router = Router();

// POST /api/auth/register - Register a new User
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, role, name, phone } = req.body;

  if (!email || !password || !role || !name) {
    return res.status(400).json({ error: 'Missing required registration parameters' });
  }

  if (!['PATIENT', 'DOCTOR', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid account role specification' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Hash the password (bcrypt salt factor 12 as per specification)
    const passwordHash = await bcrypt.hash(password, 12);

    // Save user configuration
    const user = new User({
      email,
      passwordHash,
      role,
      name,
      phone,
    });
    await user.save();

    // Generate JWT token (expires in 7 days as per specification)
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development';
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/login - Login existing User
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Compare bcrypt hashes
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Query profile completed status to return in initial payload
    let profileCompleted = false;
    if (user.role === 'PATIENT') {
      const profile = await PatientProfile.findOne({ userId: user._id });
      profileCompleted = !!profile;
    } else if (user.role === 'DOCTOR') {
      const profile = await DoctorProfile.findOne({ userId: user._id });
      profileCompleted = !!profile;
    }

    // Sign JWT
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development';
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        profileCompleted,
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/forgot-password - Initiate password reset (FR-01)
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Return 200 for security reasons (user enumeration safeguard)
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a reset link has been generated.',
      });
    }

    // Generate token
    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour expiry

    await user.save();

    // Console link logging for easy local testing
    console.log('\n=================================================');
    console.log('  PASSWORD RESET LINK INITIATED');
    console.log(`  Target Email : ${email}`);
    console.log(`  Reset URL    : http://localhost:3000/reset-password?token=${token}`);
    console.log('=================================================\n');

    return res.status(200).json({
      success: true,
      message: 'Password reset link generated and logged.',
      token, // Return token directly to facilitate client testing without mail servers
    });
  } catch (error) {
    console.error('Forgot password request failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/reset-password - Complete password reset (FR-01)
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset completed successfully. You may now log in.',
    });
  } catch (error) {
    console.error('Password reset completion failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
