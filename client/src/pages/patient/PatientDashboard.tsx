import React, { useEffect, useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { db } from '../../lib/offlineDB';
import { SyncStatusWidget } from '../../components/sync/SyncStatusWidget';

import api from '../../lib/apiClient';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ bloodGroup?: string; gender?: string } | null>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      db.cached_profile.get(user.id).then((p) => {
        if (p) setProfile(p);
      });

      Promise.all([
        api.get('/consultations').then((res) => setConsultations(res.data.consultations || [])),
        api.get('/patients/me/medications').then((res) => setMedications(res.data.medications || [])),
      ])
        .catch((err) => console.error('Dashboard data fetch error:', err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  const initials = user?.name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

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
  const followUpsCount = consultations.filter((c) => c.status === 'FOLLOW_UP_PENDING').length;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-8 pb-20">

      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">
          Good morning, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Patient header card */}
      <div className="glass rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full glass-subtle flex items-center justify-center text-[18px] font-medium text-sky-900 flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-medium text-sky-900">{user?.name}</div>
          <div className="text-[13px] text-[#C49A38] mt-0.5">
            {profile?.bloodGroup && `Blood group: ${profile.bloodGroup}`}
            {profile?.bloodGroup && profile?.gender && ' · '}
            {profile?.gender && profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase()}
          </div>
        </div>
        <div
          className="text-[11px] font-medium px-3 py-1 rounded-pill"
          style={{
            background: 'rgba(16,185,129,0.16)',
            border: '0.5px solid rgba(16,185,129,0.40)',
            color: '#065F46',
          }}
        >
          ● Active
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        {[
          { label: 'Consultations', value: consultationsCount,  sub: 'Total' },
          { label: 'Conditions',    value: conditionsCount,     sub: 'Active' },
          { label: 'Medications',   value: activeMedicationsCount, sub: 'Active' },
          { label: 'Follow-ups',    value: followUpsCount,      sub: 'Scheduled' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-lg p-4">
            <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">
              {stat.label}
            </div>
            <div className="text-[24px] font-medium text-sky-900 leading-none">{stat.value}</div>
            <div className="text-[12px] text-[#78716C] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Phase 3 notice */}
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-[14px] font-medium text-sky-900 mb-2">
          CONTINUUM is fully operational ✓
        </div>
        <p className="text-[13px] text-[#78716C] leading-relaxed">
          Your offline profile, doctor connections, async consultations, and audio transcriptions are active. 
          Send a request or open a new consultation to share details with your doctor.
        </p>
      </div>

      {/* Sync widget */}
      <SyncStatusWidget />
    </div>
  );
};
