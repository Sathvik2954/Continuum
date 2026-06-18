import { type Request, type Response, type NextFunction } from 'express';
import PatientDoctorLink from '../models/PatientDoctorLink';

// Helper function to assert relationship access programmatically
export async function assertPatientAccess(
  userId: string,
  patientId: string,
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN'
): Promise<boolean> {
  // 1. Patients can always access their own files
  if (role === 'PATIENT') {
    return userId === patientId;
  }

  // 2. Doctors can access if and only if they have an ACTIVE link
  if (role === 'DOCTOR') {
    const activeLink = await PatientDoctorLink.findOne({
      patientId,
      doctorId: userId,
      status: 'ACTIVE',
    });
    return !!activeLink;
  }

  // Admins do not have access to clinical patient records directly
  return false;
}

// Middleware wrapper that inspects request parameters for patientId
export const checkPatientAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Missing session info' });
  }

  const patientId = req.params.patientId || req.params.id;
  if (!patientId) {
    return res.status(400).json({ error: 'Bad Request: Missing patient context' });
  }

  try {
    const isAuthorized = await assertPatientAccess(
      req.user.userId,
      patientId,
      req.user.role
    );

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access this patient\'s records' });
    }

    next();
  } catch (error) {
    console.error('Patient access check error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
