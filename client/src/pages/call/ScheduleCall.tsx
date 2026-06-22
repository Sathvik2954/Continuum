import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { GlassCard } from '../../components/ui/GlassCard';

interface Counterpart {
  id: string;
  name: string;
  specialization?: string;
}

const DURATIONS = [15, 30, 45, 60];

export const ScheduleCallPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPatient = user?.role === 'PATIENT';

  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [counterpartId, setCounterpartId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(15);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const endpoint = isPatient ? '/connections/my-doctors' : '/connections/my-patients';
    api.get(endpoint).then((res) => {
      const list = isPatient
        ? res.data.connections
            .filter((c: { link: { status: string } }) => c.link.status === 'ACTIVE')
            .map((c: { link: { doctorId: string }; doctor: { name: string; specialization: string } }) => ({
              id: c.link.doctorId, name: c.doctor.name, specialization: c.doctor.specialization,
            }))
        : res.data.patients.map((p: { patient: { _id: string; name: string } }) => ({
            id: p.patient._id, name: p.patient.name,
          }));
      setCounterparts(list);
    }).catch(() => setCounterparts([]));
  }, [isPatient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!counterpartId || !date || !time) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const res = await api.post('/calls', {
        counterpartId, scheduledAt, estimatedDurationMin: duration, preCallNotes: notes,
      });
      navigate(`/calls/${res.data.call._id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to schedule call');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-24">
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">Schedule a live call</h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          {isPatient ? 'Both you and the doctor need to be online at the same time' : 'Schedule a video check-in with your patient'}
        </p>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md text-[12px] text-[#991B1B]"
              style={{ background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.35)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              {isPatient ? 'Doctor' : 'Patient'}
            </label>
            <select
              value={counterpartId}
              onChange={(e) => setCounterpartId(e.target.value)}
              className="glass-input w-full h-10 px-3 text-[14px] text-sky-900"
            >
              <option value="">Select…</option>
              {counterparts.map((c) => (
                <option key={c.id} value={c.id}>
                  {isPatient ? `Dr. ${c.name}` : c.name}{c.specialization ? ` - ${c.specialization}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-2">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d} type="button" onClick={() => setDuration(d)}
                  className="flex-1 py-2 text-[13px] font-medium rounded-sm transition-all duration-150"
                  style={duration === d
                    ? { background: 'rgba(14,165,233,0.22)', border: '0.5px solid rgba(14,165,233,0.50)', color: '#0284C7' }
                    : { background: 'rgba(255,255,255,0.14)', border: '0.5px solid rgba(255,255,255,0.35)', color: '#78716C' }}>
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              Notes <span className="text-[#A8A29E] font-normal">(optional)</span>
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="What would you like to discuss?"
              className="glass-input w-full px-3 py-2 text-[14px] text-sky-900 placeholder:text-[#A8A29E] resize-none" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full h-11 rounded-sm text-[14px] font-medium text-cream-50 disabled:opacity-50"
            style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}>
            {submitting ? 'Scheduling…' : 'Schedule call'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};
