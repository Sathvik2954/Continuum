import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../lib/authContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { SyncStatusWidget } from '../../components/sync/SyncStatusWidget';
import api from '../../lib/apiClient';

interface Patient {
  link: { _id: string; status: string; requestedAt: string };
  patient: { _id: string; name: string; email: string; phone?: string };
}

interface Request {
  link: { _id: string; status: string; requestedAt: string; expiresAt: string };
  patient: { _id: string; name: string; email: string };
}

type Tab = 'patients' | 'requests';

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/connections/my-patients');
      setPatients(res.data.patients);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/connections/requests');
      setRequests(res.data.requests);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchRequests();
  }, [fetchPatients, fetchRequests]);

  const handleRespond = async (linkId: string, action: 'accept' | 'decline') => {
    setResponding(linkId);
    try {
      await api.patch(`/connections/${linkId}/respond`, { action });
      setRequests((prev) => prev.filter((r) => r.link._id !== linkId));
      if (action === 'accept') fetchPatients();
    } catch {
      alert('Failed to respond. Please try again.');
    } finally {
      setResponding(null);
    }
  };

  const initials = user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="max-w-5xl mx-auto px-6 pt-8 pb-24">

      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">
          Good morning, Dr. {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      <GlassCard className="p-5 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full glass-subtle flex items-center justify-center text-[18px] font-medium text-sky-900 flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <div className="text-[16px] font-medium text-sky-900">Dr. {user?.name}</div>
          <div className="text-[13px] text-[#78716C] mt-0.5">{user?.email}</div>
        </div>
        <StatusPill variant="unverified" />
      </GlassCard>

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        {[
          { label: 'My Patients',   value: patients.length,  sub: 'Connected' },
          { label: 'Requests',      value: requests.length,  sub: 'Awaiting response', alert: requests.length > 0 },
          { label: 'Consultations', value: 0,                sub: 'Pending review' },
          { label: 'Follow-ups',    value: 0,                sub: 'Due today' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4">
            <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">
              {stat.label}
            </div>
            <div className="text-[24px] font-medium leading-none"
              style={{ color: stat.alert ? '#78350F' : '#0C4A6E' }}>
              {stat.value}
            </div>
            <div className="text-[12px] text-[#78716C] mt-1">{stat.sub}</div>
          </GlassCard>
        ))}
      </div>

      <div className="flex gap-1 mb-5 glass-subtle rounded-sm p-1 w-fit">
        {([
          { key: 'patients', label: `My Patients (${patients.length})` },
          { key: 'requests', label: `Requests (${requests.length})` },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-xs transition-all duration-150 ${
              tab === t.key ? 'glass text-sky-900' : 'text-[#78716C]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'patients' && (
        <div>
          {loadingPatients ? (
            <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading patients…</GlassCard>
          ) : patients.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <div className="text-[14px] font-medium text-sky-900 mb-1">No patients yet</div>
              <p className="text-[13px] text-[#78716C]">Connection requests from patients will appear in the Requests tab.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {patients.map((p) => (
                <GlassCard key={p.link._id} className="p-4 card-hover" hover>
                  <div className="flex items-center gap-4">
                    <Avatar name={p.patient.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium text-sky-900">{p.patient.name}</div>
                      <div className="text-[12px] text-[#78716C] mt-0.5">{p.patient.email}</div>
                    </div>
                    <StatusPill variant="active" />
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div>
          {loadingRequests ? (
            <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading requests…</GlassCard>
          ) : requests.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <div className="text-[14px] font-medium text-sky-900 mb-1">No pending requests</div>
              <p className="text-[13px] text-[#78716C]">Connection requests from patients will appear here.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const daysLeft = Math.max(0,
                  Math.ceil((new Date(r.link.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                );
                return (
                  <GlassCard key={r.link._id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar name={r.patient.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-sky-900">{r.patient.name}</div>
                        <div className="text-[12px] text-[#78716C] mt-0.5">
                          Requested · {new Date(r.link.requestedAt).toLocaleDateString('en-IN')}
                          {' · '}
                          <span style={{ color: daysLeft <= 2 ? '#991B1B' : '#78716C' }}>
                            Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleRespond(r.link._id, 'accept')}
                          disabled={responding === r.link._id}
                          className="text-[13px] font-medium px-4 py-2 rounded-sm disabled:opacity-50"
                          style={{ background: 'rgba(16,185,129,0.20)', border: '0.5px solid rgba(16,185,129,0.45)', color: '#065F46' }}>
                          {responding === r.link._id ? '…' : 'Accept'}
                        </button>
                        <button onClick={() => handleRespond(r.link._id, 'decline')}
                          disabled={responding === r.link._id}
                          className="text-[13px] font-medium px-4 py-2 rounded-sm glass-subtle disabled:opacity-50 text-[#78716C]">
                          Decline
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SyncStatusWidget />
    </div>
  );
};
