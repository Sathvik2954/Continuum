import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import { Condition } from '../models/Condition';
import { PatientChange } from '../models/PatientChange';
import { PatientDoctorLink } from '../models/PatientDoctorLink';

const router = Router();
router.use(verifyToken);

// ─── DOCTOR: Add condition to a patient ───────────────────────────────────────

router.post(
  '/patients/:patientId/conditions',
  requireRole('DOCTOR'),
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.user!.userId;
      const { patientId } = req.params;
      const { conditionName, severity, diagnosedOn, notes, consultationId } = req.body;

      if (!conditionName || !severity) {
        res.status(400).json({ error: 'conditionName and severity are required' });
        return;
      }

      if (!['MILD', 'MODERATE', 'SEVERE'].includes(severity)) {
        res.status(400).json({ error: 'severity must be MILD, MODERATE, or SEVERE' });
        return;
      }

      const condition = await Condition.create({
        patientId: new mongoose.Types.ObjectId(patientId),
        addedByDoctorId: new mongoose.Types.ObjectId(doctorId),
        consultationId: consultationId ? new mongoose.Types.ObjectId(consultationId) : undefined,
        conditionName,
        severity,
        diagnosedOn: diagnosedOn ? new Date(diagnosedOn) : new Date(),
        status: 'ACTIVE',
        notes,
      });

      // Audit log
      await PatientChange.create({
        patientId: new mongoose.Types.ObjectId(patientId),
        entityType: 'CONDITION',
        entityId: condition._id,
        fieldChanged: 'conditionName',
        newValue: conditionName,
        changedBy: new mongoose.Types.ObjectId(doctorId),
        changedByRole: 'DOCTOR',
      });

      res.status(201).json({ condition });
    } catch (err) {
      console.error('Add condition error:', err);
      res.status(500).json({ error: 'Failed to add condition' });
    }
  }
);

// ─── GET conditions for a patient ─────────────────────────────────────────────

router.get(
  '/patients/:patientId/conditions',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const { status } = req.query;

      const filter: Record<string, unknown> = {
        patientId: new mongoose.Types.ObjectId(patientId),
      };
      if (status) filter.status = status;

      const conditions = await Condition.find(filter).sort({ createdAt: -1 });

      res.json({ conditions });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch conditions' });
    }
  }
);

// ─── DOCTOR: Update condition (e.g. mark resolved, change severity) ──────────

router.patch(
  '/conditions/:conditionId',
  requireRole('DOCTOR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.user!.userId;
      const { conditionId } = req.params;
      const { severity, status, notes } = req.body;

      const condition = await Condition.findById(conditionId);
      if (!condition) {
        res.status(404).json({ error: 'Condition not found' });
        return;
      }

      // Verify the doctor is connected to the patient
      const link = await PatientDoctorLink.findOne({
        patientId: condition.patientId,
        doctorId: new mongoose.Types.ObjectId(doctorId),
        status: 'ACTIVE',
      });
      if (!link) {
        res.status(403).json({ error: 'Access denied — no active connection with this patient' });
        return;
      }

      // Only the doctor who added it (or any ACTIVE-linked doctor) can update —
      // here we keep it simple: any doctor with active access to the patient.
      const changes: { field: string; oldValue: string; newValue: string }[] = [];

      if (severity && severity !== condition.severity) {
        changes.push({ field: 'severity', oldValue: condition.severity, newValue: severity });
        condition.severity = severity;
      }
      if (status && status !== condition.status) {
        changes.push({ field: 'status', oldValue: condition.status, newValue: status });
        condition.status = status;
      }
      if (notes !== undefined && notes !== condition.notes) {
        changes.push({ field: 'notes', oldValue: condition.notes || '', newValue: notes });
        condition.notes = notes;
      }

      await condition.save();

      // Audit log each changed field
      if (changes.length > 0) {
        await PatientChange.insertMany(
          changes.map((c) => ({
            patientId: condition.patientId,
            entityType: 'CONDITION',
            entityId: condition._id,
            fieldChanged: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            changedBy: new mongoose.Types.ObjectId(doctorId),
            changedByRole: 'DOCTOR',
          }))
        );
      }

      res.json({ condition });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update condition' });
    }
  }
);

export default router;
