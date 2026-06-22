import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/authContext';
import { db } from '../../lib/offlineDB';
import { SyncStatusWidget } from '../../components/sync/SyncStatusWidget';
import { FollowUpsList } from '../../components/followups/FollowUpsList';
import { GlassCard } from '../../components/ui/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import api from '../../lib/apiClient';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<{ bloodGroup?: string; gender?: string } | null>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [followUpsList, setFollowUpsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      db.cached_profile.get(user.id).then((p) => {
        if (p) setProfile(p);
      });

      Promise.all([
        api.get('/consultations').then((res) => setConsultations(res.data.consultations || [])),
        api.get('/patients/me/medications').then((res) => setMedications(res.data.medications || [])),
        api.get('/calls').then((res) => setCalls(res.data.calls || [])),
        api.get(`/followups/patients/${user.id}`).then((res) => setFollowUpsList(res.data.followUps || [])),
      ])
        .catch((err) => console.error('Dashboard data fetch error:', err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  // Calculate active conditions (derived from checked symptoms in active consultations)
  const activeSymptoms = new Set<string>();
  consultations.forEach((c) => {
    if (c.status !== 'CLOSED' && c.symptomsChecklist) {
      Object.entries(c.symptomsChecklist).forEach(([symptom, checked]) => {
        if (checked && symptom !== 'other') {
          activeSymptoms.add(symptom);
        }
      });
    }
  });

  const consultationsCount = consultations.length;
  const conditionsCount = activeSymptoms.size;
  const activeMedicationsCount = medications.filter((m) => !m.isExpired).length;
  const followUpsCount = followUpsList.filter((f) => !f.completed).length;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-8 pb-24">

      {/* Greeting + Schedule Call */}
      <div className="mb-7 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-sky-900">
            {t('dashboard.goodMorning')}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-[13px] text-[#78716C] mt-1">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => navigate('/calls/schedule')}
          className="text-[13px] font-medium px-4 py-2.5 rounded-sm text-cream-50"
          style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
        >
          📞 {t('dashboard.scheduleCall')}
        </button>
      </div>

      {/* Patient header card */}
      <GlassCard className="p-5 mb-6 flex items-center gap-4">
        <Avatar name={user?.name ?? '?'} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-medium text-sky-900">{user?.name}</div>
          <div className="text-[13px] text-[#C49A38] mt-0.5">
            {profile?.bloodGroup && `${profile.bloodGroup}`}
            {profile?.bloodGroup && profile?.gender && ' · '}
            {profile?.gender && profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase()}
          </div>
        </div>
        <StatusPill variant="active" />
      </GlassCard>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <StatCard label={t('dashboard.consultations')} value={consultationsCount} sub={t('dashboard.total')} />
        <StatCard label={t('dashboard.conditions')} value={conditionsCount} sub={t('dashboard.active')} />
        <StatCard label={t('dashboard.medications')} value={activeMedicationsCount} sub={t('dashboard.active')} />
        <StatCard label={t('dashboard.followUpsDue')} value={followUpsCount} sub={t('dashboard.scheduled')} />
      </div>

      {/* Scheduled Live Calls */}
      {calls.filter((c) => ['SCHEDULED', 'CONFIRMED', 'PATIENT_JOINED', 'DOCTOR_JOINED', 'ACTIVE'].includes(c.status)).length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-medium text-sky-900 mb-3">Scheduled Live Calls</h2>
          <div className="space-y-2">
            {calls
              .filter((c) => ['SCHEDULED', 'CONFIRMED', 'PATIENT_JOINED', 'DOCTOR_JOINED', 'ACTIVE'].includes(c.status))
              .map((c) => (
                <GlassCard key={c._id} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="text-[13px] font-medium text-sky-900">
                      Live Call with Dr. {c.doctorId?.name || 'your Doctor'}
                    </div>
                    <div className="text-[11px] text-[#78716C] mt-0.5">
                      {new Date(c.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <Link to={`/calls/${c._id}`} className="px-3.5 py-1.5 text-[11px] font-medium text-cream-50 rounded-sm" style={{ background: '#10B981', border: '0.5px solid rgba(255,255,255,0.45)' }}>
                    Join
                  </Link>
                </GlassCard>
              ))}
          </div>
        </div>
      )}

      {user?.id && (
        <div className="mb-6">
          <h2 className="text-[16px] font-medium text-sky-900 mb-3">{t('dashboard.scheduledFollowUps')}</h2>
          <FollowUpsList patientId={user.id} isPatientView={true} />
        </div>
      )}

      {/* Status card */}
      <GlassCard className="p-6 text-center">
        <div className="text-[14px] font-medium text-sky-900 mb-2">
          {t('dashboard.operational')} ✓
        </div>
        <p className="text-[13px] text-[#78716C] leading-relaxed">
          {t('dashboard.operationalDesc')}
        </p>
      </GlassCard>

      <SyncStatusWidget />
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; sub: string }> = ({ label, value, sub }) => (
  <GlassCard className="p-4">
    <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">{label}</div>
    <div className="text-[24px] font-medium text-sky-900 leading-none">{value}</div>
    <div className="text-[12px] text-[#78716C] mt-1">{sub}</div>
  </GlassCard>
);
