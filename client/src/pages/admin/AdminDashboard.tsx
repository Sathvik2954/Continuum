import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/apiClient';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatusPill } from '../../components/ui/StatusPill';

interface AdminAnalytics {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  verifiedDoctors: number;
  unverifiedDoctors: number;
  platformFollowUpRate: number;
  totalCalls: number;
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  verified?: boolean;
  specialization?: string;
  createdAt: string;
}

interface StorageInfo {
  totalFiles: number;
  totalSizeMb: number;
}

export const AdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PATIENT' | 'DOCTOR'>('ALL');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [analyticsRes, usersRes, storageRes] = await Promise.all([
        api.get('/analytics/admin'),
        api.get('/admin/users'),
        api.get('/admin/storage'),
      ]);
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data.users);
      setStorage(storageRes.data);
    } catch {
      // silently fail — likely not an admin
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleVerify = async (userId: string, currentlyVerified: boolean) => {
    setVerifying(userId);
    try {
      await api.patch(`/admin/doctors/${userId}/verify`, { verified: !currentlyVerified });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, verified: !currentlyVerified } : u)));
    } catch {
      alert('Failed to update verification status');
    } finally {
      setVerifying(null);
    }
  };

  const filteredUsers = filter === 'ALL' ? users : users.filter((u) => u.role === filter);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 pt-8">
        <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading admin panel…</GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">Admin panel</h1>
        <p className="text-[13px] text-[#78716C] mt-1">Platform overview and user management</p>
      </div>

      {/* Stat cards */}
      {analytics && (
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
          <GlassCard className="p-4">
            <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Total users</div>
            <div className="text-[24px] font-medium text-sky-900">{analytics.totalUsers}</div>
            <div className="text-[12px] text-[#78716C] mt-1">{analytics.totalPatients} patients · {analytics.totalDoctors} doctors</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Verified doctors</div>
            <div className="text-[24px] font-medium text-sky-900">{analytics.verifiedDoctors}</div>
            <div className="text-[12px] mt-1" style={{ color: analytics.unverifiedDoctors > 0 ? '#78350F' : '#78716C' }}>
              {analytics.unverifiedDoctors} pending
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Follow-up rate</div>
            <div className="text-[24px] font-medium text-sky-900">{analytics.platformFollowUpRate}%</div>
            <div className="text-[12px] text-[#78716C] mt-1">Platform-wide</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Live calls</div>
            <div className="text-[24px] font-medium text-sky-900">{analytics.totalCalls}</div>
            <div className="text-[12px] text-[#78716C] mt-1">Completed</div>
          </GlassCard>
        </div>
      )}

      {/* Storage usage */}
      {storage && (
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Storage usage</div>
              <div className="text-[13px] text-sky-900">{storage.totalFiles} files · {storage.totalSizeMb}MB</div>
            </div>
            {storage.totalSizeMb > 800 && <StatusPill variant="urgent" label="Approaching limit" />}
          </div>
        </GlassCard>
      )}

      {/* User management */}
      <div className="flex gap-1 mb-4 glass-subtle rounded-sm p-1 w-fit">
        {(['ALL', 'PATIENT', 'DOCTOR'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-xs transition-all duration-150 ${
              filter === f ? 'glass text-sky-900' : 'text-[#78716C]'
            }`}>
            {f === 'ALL' ? 'All users' : f === 'PATIENT' ? 'Patients' : 'Doctors'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredUsers.map((u) => (
          <GlassCard key={u._id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-sky-900">
                  {u.role === 'DOCTOR' ? 'Dr. ' : ''}{u.name}
                </div>
                <div className="text-[12px] text-[#78716C]">
                  {u.email}{u.specialization ? ` · ${u.specialization}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {u.role === 'DOCTOR' && (
                  <>
                    <StatusPill variant={u.verified ? 'verified' : 'unverified'} />
                    <button
                      onClick={() => handleVerify(u._id, !!u.verified)}
                      disabled={verifying === u._id}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-sm disabled:opacity-50"
                      style={
                        u.verified
                          ? { background: 'rgba(168,162,158,0.18)', border: '0.5px solid rgba(168,162,158,0.35)', color: '#57534E' }
                          : { background: 'rgba(16,185,129,0.20)', border: '0.5px solid rgba(16,185,129,0.45)', color: '#065F46' }
                      }
                    >
                      {verifying === u._id ? '…' : u.verified ? 'Revoke' : 'Verify'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};
