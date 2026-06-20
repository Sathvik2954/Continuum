import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PatientDoctorLink } from '../models/PatientDoctorLink';

/**
 * assertPatientAccess — runs at the top of every patient-data route.
 *
 * Rules:
 *  - PATIENT can only access their own data (patientId === req.user.userId)
 *  - DOCTOR can only access data of patients with an ACTIVE link
 *  - ADMIN can access any patient data
 *
 * Usage:
 *   router.get('/patients/:patientId/timeline',
 *     verifyToken,
 *     assertPatientAccess('patientId'),  // param name
 *     handler
 *   )
 */
export const assertPatientAccess = (paramName = 'patientId') => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, role } = req.user!;
      const patientId = req.params[paramName];

      if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
        res.status(400).json({ error: 'Invalid patient ID' });
        return;
      }

      // Admin — unrestricted
      if (role === 'ADMIN') { next(); return; }

      // Patient — own data only
      if (role === 'PATIENT') {
        if (userId !== patientId) {
          res.status(403).json({ error: 'You can only access your own data' });
          return;
        }
        next();
        return;
      }

      // Doctor — must have an ACTIVE link
      if (role === 'DOCTOR') {
        const link = await PatientDoctorLink.findOne({
          patientId: new mongoose.Types.ObjectId(patientId),
          doctorId: new mongoose.Types.ObjectId(userId),
          status: 'ACTIVE',
        });

        if (!link) {
          res.status(403).json({
            error: 'Access denied — no active connection with this patient',
          });
          return;
        }

        next();
        return;
      }

      res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      console.error('assertPatientAccess error:', err);
      res.status(500).json({ error: 'Access check failed' });
    }
  };
};
