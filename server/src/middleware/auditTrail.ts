import { Request, Response, NextFunction } from 'express';
import { PatientChange } from '../models/PatientChange';
import mongoose from 'mongoose';

interface AuditOptions {
  entityType: 'PROFILE' | 'CONDITION' | 'CONSULTATION' | 'MEDICATION';
  getPatientId: (req: Request) => string;
  getEntityId: (req: Request) => string;
  fields: string[];
}

/**
 * Logs changes to patient data before every write.
 * Used as route-level middleware on PATCH/PUT routes.
 */
export const auditLog = (options: AuditOptions) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) { next(); return; }

      const patientId = options.getPatientId(req);
      const entityId = options.getEntityId(req);
      const changedBy = req.user.userId;
      const changedByRole = req.user.role;

      // Log each changed field
      const changes = options.fields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => ({
          patientId: new mongoose.Types.ObjectId(patientId),
          entityType: options.entityType,
          entityId: new mongoose.Types.ObjectId(entityId),
          fieldChanged: field,
          newValue: String(req.body[field]),
          changedBy: new mongoose.Types.ObjectId(changedBy),
          changedByRole,
          changedAt: new Date(),
        }));

      if (changes.length > 0) {
        await PatientChange.insertMany(changes);
      }

      next();
    } catch (err) {
      // Audit failure should NOT block the actual write
      console.error('Audit log error:', err);
      next();
    }
  };
};
