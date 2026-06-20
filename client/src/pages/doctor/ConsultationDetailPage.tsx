import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { resolveFileUrl } from '../../lib/resolveFileUrl';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatusPill } from '../../components/ui/StatusPill';
import { AudioPlayer } from '../../components/consultation/AudioPlayer';
import { AudioRecorderField } from '../../components/consultation/AudioRecorderField';

interface MedicationForm {
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  instructions: string;
}

const EMPTY_MED: MedicationForm = {
  medicineName: '', dosage: '', frequency: '', durationDays: '', instructions: '',
};

interface Consultation {
  _id: string;
  patientId: string;
  doctorId: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: string;
  patientNotes?: string;
  checkinTopic?: string;
  symptomsChecklist?: Record<string, boolean | string>;
  symptomAudioUrl?: string;
  doctorResponseAudioUrl?: string;
  doctorNotes?: string;
  followUpDate?: string;
  createdAt: string;
}

interface Medication {
  _id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export const ConsultationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  // Doctor response form state
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [meds, setMeds] = useState<MedicationForm[]>([{ ...EMPTY_MED }]);
  const [responseAudio, setResponseAudio] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDoctor = user?.role === 'DOCTOR';

  const fetchData = async () => {
    try {
      const res = await api.get(`/consultations/${id}`);
      setConsultation(res.data.consultation);
      setMedications(res.data.medications);

      // Auto mark as reviewing if doctor opens a fresh submission
      if (
        isDoctor &&
        res.data.consultation.status === 'PATIENT_SUBMITTED'
      ) {
        await api.patch(`/consultations/${id}/review`);
        setConsultation((prev) => prev ? { ...prev, status: 'DOCTOR_REVIEWING' } : prev);
      }
    } catch {
      navigate('/consultations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMed = (index: number, field: keyof MedicationForm, value: string) => {
    setMeds((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const addMed = () => setMeds((prev) => [...prev, { ...EMPTY_MED }]);
  const removeMed = (index: number) => setMeds((prev) => prev.filter((_, i) => i !== index));

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('doctorNotes', doctorNotes);
      if (followUpDate) formData.append('followUpDate', followUpDate);

      const validMeds = meds.filter((m) => m.medicineName && m.dosage && m.frequency && m.durationDays);
      if (validMeds.length > 0) {
        formData.append('medications', JSON.stringify(
          validMeds.map((m) => ({ ...m, durationDays: parseInt(m.durationDays) }))
        ));
      }
      if (responseAudio) {
        formData.append('audio', responseAudio, 'response.webm');
      }

      await api.post(`/consultations/${id}/respond`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading…</GlassCard>
      </div>
    );
  }

  if (!consultation) return null;

  const symptomLabels = consultation.symptomsChecklist
    ? Object.entries(consultation.symptomsChecklist)
        .filter(([k, v]) => k !== 'other' && v === true)
        .map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase())
    : [];

  const canRespond = isDoctor && ['DOCTOR_REVIEWING', 'PATIENT_SUBMITTED'].includes(consultation.status);
  const hasResponded = consultation.status === 'DOCTOR_RESPONDED' || consultation.status === 'FOLLOW_UP_PENDING';

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-24">
      <button onClick={() => navigate(-1)} className="text-[13px] text-sky-600 mb-4">
        ← Back
      </button>

      {/* Header */}
      <GlassCard className="p-5 mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {consultation.priority === 'URGENT' && <StatusPill variant="urgent" />}
          {consultation.priority === 'HIGH' && <StatusPill variant="high" />}
          <StatusPill
            variant={hasResponded ? 'synced' : 'pending'}
            label={consultation.status.replace(/_/g, ' ').toLowerCase()}
          />
        </div>
        {consultation.checkinTopic && (
          <div className="text-[16px] font-medium text-sky-900 mb-1">
            {consultation.checkinTopic}
          </div>
        )}
        <div className="text-[12px] text-[#78716C]">
          Submitted {new Date(consultation.createdAt).toLocaleString('en-IN')}
        </div>
      </GlassCard>

      {/* Symptoms */}
      {symptomLabels.length > 0 && (
        <GlassCard className="p-5 mb-5">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2">
            Symptoms
          </div>
          <div className="flex flex-wrap gap-2">
            {symptomLabels.map((s) => (
              <span key={s} className="text-[12px] capitalize px-3 py-1 rounded-pill"
                style={{ background: 'rgba(14,165,233,0.15)', border: '0.5px solid rgba(14,165,233,0.35)', color: '#0284C7' }}>
                {s}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Patient notes */}
      {consultation.patientNotes && (
        <GlassCard className="p-5 mb-5">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2">
            Patient notes
          </div>
          <p className="text-[14px] text-sky-900">{consultation.patientNotes}</p>
        </GlassCard>
      )}

      {/* Symptom audio */}
      {consultation.symptomAudioUrl && (
        <div className="mb-5">
          <AudioPlayer src={resolveFileUrl(consultation.symptomAudioUrl)} label="Symptom audio" />
        </div>
      )}

      {/* Doctor response (if exists) */}
      {hasResponded && (
        <GlassCard className="p-5 mb-5" elevated>
          <div className="text-[11px] font-medium text-[#065F46] uppercase tracking-wider mb-3">
            Doctor's response
          </div>
          {consultation.doctorNotes && (
            <p className="text-[14px] text-sky-900 mb-3">{consultation.doctorNotes}</p>
          )}
          {consultation.doctorResponseAudioUrl && (
            <div className="mb-3">
              <AudioPlayer src={resolveFileUrl(consultation.doctorResponseAudioUrl)} label="Doctor response audio" />
            </div>
          )}
          {consultation.followUpDate && (
            <div className="text-[13px] text-[#78350F] mb-2">
              📅 Follow-up scheduled: {new Date(consultation.followUpDate).toLocaleDateString('en-IN')}
            </div>
          )}
          {medications.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2">
                Prescribed medications
              </div>
              <div className="space-y-2">
                {medications.map((m) => (
                  <div key={m._id} className="glass-subtle rounded-md p-3">
                    <div className="text-[14px] font-medium text-sky-900">{m.medicineName}</div>
                    <div className="text-[12px] text-[#78716C] mt-0.5">
                      {m.dosage} · {m.frequency} · {m.durationDays} days
                    </div>
                    {m.instructions && (
                      <div className="text-[12px] text-sky-600 mt-1">{m.instructions}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Doctor response form */}
      {canRespond && (
        <GlassCard className="p-5" elevated>
          <div className="text-[15px] font-medium text-sky-900 mb-4">Respond to patient</div>
          <form onSubmit={handleRespond} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Clinical notes
              </label>
              <textarea
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                rows={3}
                placeholder="Diagnosis, advice, observations…"
                className="glass-input w-full px-3 py-2 text-[14px] text-sky-900 placeholder:text-[#A8A29E] resize-none"
              />
            </div>

            <AudioRecorderField
              maxDurationSeconds={300}
              onRecordingComplete={setResponseAudio}
              label="Voice response"
            />

            {/* Medications */}
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-2">
                Prescribe medications
              </label>
              <div className="space-y-3">
                {meds.map((med, i) => (
                  <div key={i} className="glass-subtle rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Medicine name"
                        value={med.medicineName}
                        onChange={(e) => updateMed(i, 'medicineName', e.target.value)}
                        className="glass-input h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
                      />
                      <input
                        placeholder="Dosage e.g. 500mg"
                        value={med.dosage}
                        onChange={(e) => updateMed(i, 'dosage', e.target.value)}
                        className="glass-input h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
                      />
                      <input
                        placeholder="Frequency e.g. Twice daily"
                        value={med.frequency}
                        onChange={(e) => updateMed(i, 'frequency', e.target.value)}
                        className="glass-input h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
                      />
                      <input
                        type="number"
                        placeholder="Duration (days)"
                        value={med.durationDays}
                        onChange={(e) => updateMed(i, 'durationDays', e.target.value)}
                        className="glass-input h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
                      />
                    </div>
                    <input
                      placeholder="Instructions e.g. Take after food"
                      value={med.instructions}
                      onChange={(e) => updateMed(i, 'instructions', e.target.value)}
                      className="glass-input w-full h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
                    />
                    {meds.length > 1 && (
                      <button type="button" onClick={() => removeMed(i)}
                        className="text-[11px] text-[#991B1B]">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addMed}
                className="text-[12px] text-sky-600 mt-2"
              >
                + Add another medication
              </button>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Follow-up date
                <span className="text-[#A8A29E] font-normal ml-1">(optional)</span>
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-sm text-[14px] font-medium text-cream-50 disabled:opacity-50"
              style={{ background: 'rgba(16,185,129,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
            >
              {submitting ? 'Submitting response…' : 'Submit response'}
            </button>
          </form>
        </GlassCard>
      )}
    </div>
  );
};
