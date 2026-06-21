import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import { Consultation } from '../models/Consultation';
import { Condition } from '../models/Condition';
import { Medication } from '../models/Medication';
import { Vital } from '../models/Vital';
import { DocumentModel } from '../models/Document';
import { User } from '../models/User';

const router = Router();
router.use(verifyToken);

export type TimelineEntryType = 'consultation' | 'condition' | 'medication' | 'vital' | 'document';

export interface TimelineEntry {
  type: TimelineEntryType;
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  meta: Record<string, unknown>;
}

// ─── GET full timeline for a patient ──────────────────────────────────────────

router.get(
  '/:patientId/timeline',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const { type } = req.query;
      const pid = new mongoose.Types.ObjectId(patientId);

      const entries: TimelineEntry[] = [];

      // ── Consultations ──────────────────────────────────────────────────────
      if (!type || type === 'consultation') {
        const consultations = await Consultation.find({ patientId: pid, isDeleted: false })
          .sort({ createdAt: -1 })
          .lean();

        for (const c of consultations) {
          const doctor = await User.findById(c.doctorId).select('name').lean();
          const symptomLabels = c.symptomsChecklist
            ? Object.entries(c.symptomsChecklist)
                .filter(([k, v]) => k !== 'other' && v === true)
                .map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase())
            : [];

          entries.push({
            type: 'consultation',
            id: c._id.toString(),
            title: c.checkinTopic || (symptomLabels.length ? symptomLabels.join(', ') : 'Consultation'),
            subtitle: `Dr. ${doctor?.name ?? 'Unknown'} · ${c.status.replace(/_/g, ' ').toLowerCase()}`,
            timestamp: c.createdAt.toISOString(),
            meta: { priority: c.priority, status: c.status, hasAudio: !!c.symptomAudioUrl, consultationType: c.type },
          });
        }
      }

      // ── Conditions ──────────────────────────────────────────────────────────
      if (!type || type === 'condition') {
        const conditions = await Condition.find({ patientId: pid }).sort({ createdAt: -1 }).lean();
        for (const cond of conditions) {
          const doctor = await User.findById(cond.addedByDoctorId).select('name').lean();
          entries.push({
            type: 'condition',
            id: cond._id.toString(),
            title: cond.conditionName,
            subtitle: `${cond.severity} · ${cond.status} · Dr. ${doctor?.name ?? 'Unknown'}`,
            timestamp: cond.createdAt.toISOString(),
            meta: { severity: cond.severity, status: cond.status },
          });
        }
      }

      // ── Medications ──────────────────────────────────────────────────────────
      if (!type || type === 'medication') {
        const medications = await Medication.find({ patientId: pid }).sort({ createdAt: -1 }).lean();
        for (const med of medications) {
          const endDate = new Date(med.startDate);
          endDate.setDate(endDate.getDate() + med.durationDays);
          const isExpired = endDate < new Date();

          entries.push({
            type: 'medication',
            id: med._id.toString(),
            title: `${med.medicineName} — ${med.dosage}`,
            subtitle: `${med.frequency} · ${med.durationDays} days${isExpired ? ' · Completed' : ' · Active'}`,
            timestamp: med.createdAt.toISOString(),
            meta: {
              isExpired,
              medicineName: med.medicineName,
              dosage: med.dosage,
              frequency: med.frequency,
              durationDays: med.durationDays,
              instructions: med.instructions,
            },
          });
        }
      }

      // ── Vitals ─────────────────────────────────────────────────────────────
      if (!type || type === 'vital') {
        const vitals = await Vital.find({ patientId: pid }).sort({ recordedAt: -1 }).lean();
        for (const v of vitals) {
          const parts: string[] = [];
          if (v.bpSystolic && v.bpDiastolic) parts.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
          if (v.bloodGlucoseFasting) parts.push(`Glucose (fasting) ${v.bloodGlucoseFasting}`);
          if (v.bloodGlucosePostMeal) parts.push(`Glucose (post-meal) ${v.bloodGlucosePostMeal}`);
          if (v.weightKg) parts.push(`${v.weightKg}kg`);
          if (v.heartRate) parts.push(`HR ${v.heartRate}bpm`);

          entries.push({
            type: 'vital',
            id: v._id.toString(),
            title: 'Vitals logged',
            subtitle: parts.join(' · ') || 'No readings',
            timestamp: v.recordedAt.toISOString(),
            meta: {
              bpSystolic: v.bpSystolic, bpDiastolic: v.bpDiastolic,
              bloodGlucoseFasting: v.bloodGlucoseFasting, bloodGlucosePostMeal: v.bloodGlucosePostMeal,
              weightKg: v.weightKg, heartRate: v.heartRate,
            },
          });
        }
      }

      // ── Documents ──────────────────────────────────────────────────────────
      if (!type || type === 'document') {
        const documents = await DocumentModel.find({ patientId: pid }).sort({ uploadedAt: -1 }).lean();
        for (const doc of documents) {
          const uploader = await User.findById(doc.uploadedBy).select('name').lean();
          entries.push({
            type: 'document',
            id: doc._id.toString(),
            title: doc.fileName,
            subtitle: `${doc.documentType.replace(/_/g, ' ').toLowerCase()} · uploaded by ${uploader?.name ?? 'Unknown'}`,
            timestamp: doc.uploadedAt.toISOString(),
            meta: { fileUrl: doc.fileUrl, documentType: doc.documentType, fileSizeKb: doc.fileSizeKb },
          });
        }
      }

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ entries });
    } catch (err) {
      console.error('Timeline fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  }
);

// ─── GET health summary — for patient header card ────────────────────────────

router.get(
  '/:patientId/summary',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const pid = new mongoose.Types.ObjectId(patientId);

      const activeConditions = await Condition.find({ patientId: pid, status: 'ACTIVE' })
        .sort({ createdAt: -1 })
        .lean();

      const allMeds = await Medication.find({ patientId: pid }).lean();
      const now = new Date();
      const activeMedications = allMeds.filter((m) => {
        const endDate = new Date(m.startDate);
        endDate.setDate(endDate.getDate() + m.durationDays);
        return endDate >= now;
      });

      const consultationCount = await Consultation.countDocuments({ patientId: pid, isDeleted: false });
      const latestVital = await Vital.findOne({ patientId: pid }).sort({ recordedAt: -1 }).lean();

      res.json({
        activeConditions,
        activeMedications,
        totalConsultations: consultationCount,
        latestVital,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  }
);

// ─── GET vitals chart data — last N readings, ascending for charting ──────────

router.get(
  '/:patientId/vitals-chart',
  assertPatientAccess('patientId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const pid = new mongoose.Types.ObjectId(patientId);

      const vitals = await Vital.find({ patientId: pid })
        .sort({ recordedAt: 1 }) // ascending for chart x-axis
        .limit(30)
        .lean();

      res.json({ vitals });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch vitals chart data' });
    }
  }
);

export default router;
