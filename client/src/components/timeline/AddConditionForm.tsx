import React, { useState } from 'react';
import api from '../../lib/apiClient';

interface Props {
  patientId: string;
  consultationId?: string;
  onAdded: () => void;
  onClose: () => void;
}

const SEVERITIES = [
  { value: 'MILD', label: 'Mild', color: '#A8A29E' },
  { value: 'MODERATE', label: 'Moderate', color: '#F59E0B' },
  { value: 'SEVERE', label: 'Severe', color: '#EF4444' },
] as const;

export const AddConditionForm: React.FC<Props> = ({ patientId, consultationId, onAdded, onClose }) => {
  const [conditionName, setConditionName] = useState('');
  const [severity, setSeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE'>('MODERATE');
  const [diagnosedOn, setDiagnosedOn] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionName.trim()) {
      setError('Condition name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/patients/${patientId}/conditions`, {
        conditionName: conditionName.trim(),
        severity,
        diagnosedOn,
        notes,
        consultationId,
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to add condition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(12,74,110,0.25)' }}
      onClick={onClose}
    >
      <div
        className="glass-elevated rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-medium text-sky-900 mb-4">Add condition</div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-md text-[12px] text-[#991B1B]"
            style={{ background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.35)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              Condition name
            </label>
            <input
              type="text"
              value={conditionName}
              onChange={(e) => setConditionName(e.target.value)}
              placeholder="e.g. Type 2 Diabetes"
              className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-2">Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className="flex-1 py-2 text-[13px] font-medium rounded-sm transition-all duration-150"
                  style={
                    severity === s.value
                      ? { background: `${s.color}28`, border: `1px solid ${s.color}70`, color: s.color === '#A8A29E' ? '#57534E' : s.color }
                      : { background: 'rgba(255,255,255,0.14)', border: '0.5px solid rgba(255,255,255,0.35)', color: '#78716C' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">Diagnosed on</label>
            <input
              type="date"
              value={diagnosedOn}
              onChange={(e) => setDiagnosedOn(e.target.value)}
              className="glass-input w-full h-10 px-3 text-[14px] text-sky-900"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              Notes <span className="text-[#A8A29E] font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Clinical observations…"
              className="glass-input w-full px-3 py-2 text-[14px] text-sky-900 placeholder:text-[#A8A29E] resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-sm text-[13px] font-medium glass-subtle text-[#78716C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-10 rounded-sm text-[13px] font-medium text-cream-50 disabled:opacity-50"
              style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
            >
              {submitting ? 'Adding…' : 'Add condition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
