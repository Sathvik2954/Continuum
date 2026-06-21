import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/apiClient';
import { queueItem } from '../../lib/syncEngine';
import { GlassCard } from '../ui/GlassCard';

interface FollowUp {
  _id: string;
  scheduledDate: string;
  type: string;
  notes?: string;
  completed: boolean;
  consultationId: string;
}

interface Props {
  patientId: string;
  isPatientView: boolean; // true = patient marking their own follow-ups complete
}

const TYPE_LABEL: Record<string, string> = {
  IN_PERSON: 'In-person visit',
  AUDIO_CHECKIN: 'Audio check-in',
  VITALS_CHECK: 'Vitals check',
  LIVE_CALL: 'Live call',
};

export const FollowUpsList: React.FC<Props> = ({ patientId, isPatientView }) => {
  const [upcoming, setUpcoming] = useState<FollowUp[]>([]);
  const [overdue, setOverdue] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchFollowUps = useCallback(async () => {
    try {
      const [upcomingRes, overdueRes] = await Promise.all([
        api.get(`/followups/patients/${patientId}?status=upcoming`),
        api.get(`/followups/patients/${patientId}?status=overdue`),
      ]);
      setUpcoming(upcomingRes.data.followUps);
      setOverdue(overdueRes.data.followUps);
    } catch {
      setUpcoming([]);
      setOverdue([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchFollowUps(); }, [fetchFollowUps]);

  const handleComplete = async (followUpId: string) => {
    setCompleting(followUpId);
    const payload = { followUpId, completedAt: new Date().toISOString() };

    try {
      if (navigator.onLine) {
        await api.post('/followups/complete', payload);
      } else {
        await queueItem('followup_completion', payload);
      }
    } catch {
      await queueItem('followup_completion', payload);
    } finally {
      setCompleting(null);
      fetchFollowUps();
    }
  };

  if (loading) {
    return <GlassCard className="p-6 text-center text-[13px] text-sky-900">Loading follow-ups…</GlassCard>;
  }

  if (upcoming.length === 0 && overdue.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <div className="text-[13px] text-[#78716C]">No follow-ups scheduled</div>
      </GlassCard>
    );
  }

  const FollowUpRow: React.FC<{ f: FollowUp; isOverdue: boolean }> = ({ f, isOverdue }) => (
    <div
      className="rounded-lg p-3.5 flex items-center justify-between gap-3"
      style={
        isOverdue
          ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)' }
          : { background: 'rgba(255,255,255,0.14)', border: '0.5px solid rgba(255,255,255,0.35)' }
      }
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium" style={{ color: isOverdue ? '#991B1B' : '#0C4A6E' }}>
          {TYPE_LABEL[f.type] || f.type}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: isOverdue ? '#B45309' : '#78716C' }}>
          {new Date(f.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {isOverdue && ' · Overdue'}
        </div>
        {f.notes && <div className="text-[11px] text-[#78716C] mt-1">{f.notes}</div>}
      </div>

      {isPatientView && (
        <button
          onClick={() => handleComplete(f._id)}
          disabled={completing === f._id}
          className="text-[11px] font-medium px-3 py-1.5 rounded-sm flex-shrink-0 disabled:opacity-50"
          style={{ background: 'rgba(16,185,129,0.20)', border: '0.5px solid rgba(16,185,129,0.45)', color: '#065F46' }}
        >
          {completing === f._id ? '…' : 'Mark done'}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-[#991B1B] uppercase tracking-wider mb-2">
            Overdue — {overdue.length}
          </div>
          <div className="space-y-2">
            {overdue.map((f) => <FollowUpRow key={f._id} f={f} isOverdue />)}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2">
            Upcoming — {upcoming.length}
          </div>
          <div className="space-y-2">
            {upcoming.map((f) => <FollowUpRow key={f._id} f={f} isOverdue={false} />)}
          </div>
        </div>
      )}
    </div>
  );
};
