import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';

interface ConsultationListItem {
  _id: string;
  patientId: string;
  doctorId: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: string;
  patientNotes?: string;
  checkinTopic?: string;
  symptomsChecklist?: Record<string, boolean | string>;
  symptomAudioUrl?: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'pending' | 'active' | 'synced' | 'normal'> = {
  PATIENT_SUBMITTED: 'pending',
  DOCTOR_REVIEWING: 'pending',
  DOCTOR_RESPONDED: 'synced',
  FOLLOW_UP_PENDING: 'active',
  CLOSED: 'normal',
  DOCTOR_CHECKIN: 'pending',
  PATIENT_RESPONDED: 'pending',
};

const STATUS_LABEL: Record<string, string> = {
  PATIENT_SUBMITTED: 'Awaiting review',
  DOCTOR_REVIEWING: 'Under review',
  DOCTOR_RESPONDED: 'Responded',
  FOLLOW_UP_PENDING: 'Follow-up pending',
  CLOSED: 'Closed',
  DOCTOR_CHECKIN: 'Check-in sent',
  PATIENT_RESPONDED: 'Patient responded',
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getSymptomSummary = (item: ConsultationListItem): string => {
  if (item.checkinTopic) return item.checkinTopic;
  if (!item.symptomsChecklist) return item.patientNotes || 'No details provided';
  const active = Object.entries(item.symptomsChecklist)
    .filter(([key, val]) => key !== 'other' && val === true)
    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());
  return active.length > 0 ? active.join(' · ') : item.patientNotes || 'No symptoms selected';
};

export const ConsultationListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<ConsultationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/consultations')
      .then((res) => setConsultations(res.data.consultations))
      .finally(() => setLoading(false));
  }, []);

  const isDoctor = user?.role === 'DOCTOR';
  const urgent = consultations.filter((c) => c.priority === 'URGENT' && c.status !== 'CLOSED');
  const others = consultations.filter((c) => !(c.priority === 'URGENT' && c.status !== 'CLOSED'));

  const ConsultationCard: React.FC<{ item: ConsultationListItem; urgent?: boolean }> = ({ item, urgent: isUrgent }) => {
    const high = item.priority === 'HIGH';
    const cardStyle = isUrgent
      ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.40)' }
      : high
      ? { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.40)' }
      : {};

    return (
      <div
        onClick={() => navigate(`/consultations/${item._id}`)}
        className={`rounded-lg p-4 cursor-pointer card-hover ${isUrgent || high ? '' : 'glass'}`}
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <Avatar name={isDoctor ? 'Patient' : 'Doctor'} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isUrgent && <StatusPill variant="urgent" />}
              {!isUrgent && high && <StatusPill variant="high" />}
              <StatusPill
                variant={STATUS_VARIANT[item.status] || 'normal'}
                label={STATUS_LABEL[item.status] || item.status}
              />
              {item.symptomAudioUrl && (
                <span className="text-[11px] text-[#78716C]">🎙 Audio attached</span>
              )}
            </div>
            <div className="text-[13px] text-sky-900 font-medium capitalize">
              {getSymptomSummary(item)}
            </div>
          </div>
          <div className="text-[11px] text-[#78716C] flex-shrink-0 whitespace-nowrap">
            {timeAgo(item.createdAt)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-sky-900">Consultations</h1>
          <p className="text-[13px] text-[#78716C] mt-1">
            {isDoctor ? 'Patient consultations awaiting your response' : 'Your submitted consultations'}
          </p>
        </div>
        {!isDoctor && (
          <a
            href="/consultations/new"
            className="text-[13px] font-medium px-4 py-2 rounded-sm"
            style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)', color: '#FEF9F0' }}
          >
            + New consultation
          </a>
        )}
      </div>

      {loading ? (
        <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading…</GlassCard>
      ) : consultations.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="text-[14px] font-medium text-sky-900 mb-1">No consultations yet</div>
          <p className="text-[13px] text-[#78716C]">
            {isDoctor ? 'Patient consultations will appear here.' : 'Submit your first consultation to get started.'}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {urgent.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[#991B1B] uppercase tracking-wider mb-3">
                ● Urgent — {urgent.length}
              </div>
              <div className="space-y-3">
                {urgent.map((item) => <ConsultationCard key={item._id} item={item} urgent />)}
              </div>
            </div>
          )}

          <div>
            {urgent.length > 0 && (
              <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">
                All consultations
              </div>
            )}
            <div className="space-y-3">
              {others.map((item) => <ConsultationCard key={item._id} item={item} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
