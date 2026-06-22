import React, { useState } from 'react';
import api from '../../lib/apiClient';
import { queueItem } from '../../lib/syncEngine';

interface Props {
  onLogged: () => void;
}

export const VitalsLogForm: React.FC<Props> = ({ onLogged }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bpSystolic: '', bpDiastolic: '',
    bloodGlucoseFasting: '', bloodGlucosePostMeal: '',
    weightKg: '', heartRate: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload: Record<string, unknown> = { recordedAt: new Date().toISOString() };
    let hasAny = false;
    for (const [key, value] of Object.entries(form)) {
      if (value !== '') {
        payload[key] = key === 'notes' ? value : Number(value);
        if (key !== 'notes') hasAny = true;
      }
    }

    if (!hasAny) {
      setError('Enter at least one reading');
      return;
    }

    setSubmitting(true);
    try {
      if (navigator.onLine) {
        await api.post('/vitals', payload);
      } else {
        await queueItem('vitals', payload);
      }
      setForm({ bpSystolic: '', bpDiastolic: '', bloodGlucoseFasting: '', bloodGlucosePostMeal: '', weightKg: '', heartRate: '', notes: '' });
      setOpen(false);
      onLogged();
    } catch {
      // Network failed even though navigator.onLine was true - queue it
      await queueItem('vitals', payload);
      setForm({ bpSystolic: '', bpDiastolic: '', bloodGlucoseFasting: '', bloodGlucosePostMeal: '', weightKg: '', heartRate: '', notes: '' });
      setOpen(false);
      onLogged();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full glass-subtle rounded-md py-3 text-[13px] font-medium text-sky-600"
      >
        + Log vitals
      </button>
    );
  }

  return (
    <div className="glass-subtle rounded-md p-4">
      {error && <div className="text-[12px] text-[#991B1B] mb-2">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="BP Systolic" value={form.bpSystolic} onChange={(v) => set('bpSystolic', v)} placeholder="120" />
          <Field label="BP Diastolic" value={form.bpDiastolic} onChange={(v) => set('bpDiastolic', v)} placeholder="80" />
          <Field label="Glucose (fasting)" value={form.bloodGlucoseFasting} onChange={(v) => set('bloodGlucoseFasting', v)} placeholder="mg/dL" />
          <Field label="Glucose (post-meal)" value={form.bloodGlucosePostMeal} onChange={(v) => set('bloodGlucosePostMeal', v)} placeholder="mg/dL" />
          <Field label="Weight (kg)" value={form.weightKg} onChange={(v) => set('weightKg', v)} placeholder="70" />
          <Field label="Heart rate" value={form.heartRate} onChange={(v) => set('heartRate', v)} placeholder="bpm" />
        </div>
        <input
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="glass-input w-full h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="flex-1 h-9 rounded-sm text-[12px] glass text-[#78716C]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-9 rounded-sm text-[12px] font-medium text-cream-50 disabled:opacity-50"
            style={{ background: 'rgba(14,165,233,0.75)', border: '0.5px solid rgba(255,255,255,0.45)' }}
          >
            {submitting ? 'Saving…' : 'Save vitals'}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder: string }> = ({
  label, value, onChange, placeholder,
}) => (
  <div>
    <label className="block text-[10px] text-[#78716C] mb-1">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="glass-input w-full h-9 px-2.5 text-[13px] text-sky-900 placeholder:text-[#A8A29E]"
    />
  </div>
);
