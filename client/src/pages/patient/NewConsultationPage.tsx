import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/apiClient';
import { GlassCard } from '../../components/ui/GlassCard';
import { SymptomChecklist, SymptomsState, EMPTY_SYMPTOMS } from '../../components/consultation/SymptomChecklist';
import { AudioRecorderField } from '../../components/consultation/AudioRecorderField';

interface DoctorOption {
  doctorId: string;
  name: string;
  specialization: string;
}

type Priority = 'NORMAL' | 'HIGH' | 'URGENT';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'NORMAL', label: 'Normal', color: '#A8A29E' },
  { value: 'HIGH', label: 'High', color: '#F59E0B' },
  { value: 'URGENT', label: 'Urgent', color: '#EF4444' },
];

interface ConnectionResponse {
  link: { status: string; doctorId: string };
  doctor: { name: string; specialization: string };
}

export const NewConsultationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDoctorId = searchParams.get('doctorId');

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState(preselectedDoctorId || '');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [symptoms, setSymptoms] = useState<SymptomsState>(EMPTY_SYMPTOMS);
  const [notes, setNotes] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/connections/my-doctors').then((res) => {
      const connections: ConnectionResponse[] = res.data.connections;
      const activeDoctors = connections
        .filter((c) => c.link.status === 'ACTIVE')
        .map((c) => ({
          doctorId: c.link.doctorId,
          name: c.doctor.name,
          specialization: c.doctor.specialization,
        }));
      setDoctors(activeDoctors);
    }).catch(() => setDoctors([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!doctorId) {
      setError('Please select a doctor');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('doctorId', doctorId);
      formData.append('priority', priority);
      formData.append('symptomsChecklist', JSON.stringify(symptoms));
      formData.append('patientNotes', notes);
      if (audioBlob) {
        formData.append('audio', audioBlob, 'symptoms.webm');
      }

      const res = await api.post('/consultations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      navigate(`/consultations/${res.data.consultation._id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to submit consultation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">New consultation</h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          Describe your symptoms and we'll send it to your doctor
        </p>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg text-[13px] text-[#991B1B]"
              style={{ background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.35)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              Select doctor
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="glass-input w-full h-10 px-3 text-[14px] text-sky-900"
            >
              <option value="">Choose a connected doctor…</option>
              {doctors.map((d) => (
                <option key={d.doctorId} value={d.doctorId}>
                  Dr. {d.name} — {d.specialization}
                </option>
              ))}
            </select>
            {doctors.length === 0 && (
              <p className="text-[12px] text-[#78350F] mt-1.5">
                You need to connect with a doctor first.{' '}
                <a href="/doctors" className="underline">Find a doctor</a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-2">Priority</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className="flex-1 py-2.5 text-[13px] font-medium rounded-sm transition-all duration-150 flex items-center justify-center gap-2"
                  style={
                    priority === opt.value
                      ? { background: `${opt.color}28`, border: `1px solid ${opt.color}70`, color: opt.color === '#A8A29E' ? '#57534E' : opt.color }
                      : { background: 'rgba(255,255,255,0.14)', border: '0.5px solid rgba(255,255,255,0.35)', color: '#78716C' }
                  }
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <SymptomChecklist value={symptoms} onChange={setSymptoms} />

          <AudioRecorderField
            maxDurationSeconds={180}
            onRecordingComplete={setAudioBlob}
            label="Describe your symptoms by voice"
          />

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              Additional notes
              <span className="text-[#A8A29E] font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything else your doctor should know?"
              className="glass-input w-full px-3 py-2 text-[14px] text-sky-900 placeholder:text-[#A8A29E] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || doctors.length === 0}
            className="w-full h-11 rounded-sm text-[14px] font-medium text-cream-50 transition-opacity disabled:opacity-50"
            style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
          >
            {submitting ? 'Submitting…' : 'Submit consultation'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};
