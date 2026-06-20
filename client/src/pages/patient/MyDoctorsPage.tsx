import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/apiClient';
import { Avatar } from '../../components/ui/Avatar';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatusPill } from '../../components/ui/StatusPill';

interface Connection {
  link: {
    _id: string;
    status: string;
    requestedAt: string;
    respondedAt?: string;
  };
  doctor: {
    name: string;
    specialization: string;
    clinicName: string;
    city: string;
  };
}

export const MyDoctorsPage: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      const res = await api.get('/connections/my-doctors');
      setConnections(res.data.connections);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnections(); }, []);

  const handleRevoke = async (linkId: string) => {
    if (!confirm('Revoke this doctor\'s access to your health records?')) return;
    setRevoking(linkId);
    try {
      await api.delete(`/connections/${linkId}`);
      setConnections((prev) => prev.filter((c) => c.link._id !== linkId));
    } catch {
      alert('Failed to revoke. Please try again.');
    } finally {
      setRevoking(null);
    }
  };

  const active = connections.filter((c) => c.link.status === 'ACTIVE');
  const pending = connections.filter((c) => c.link.status === 'PENDING');

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <div className="glass rounded-xl p-8 text-center text-[14px] text-sky-900">
          Loading your doctors…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-sky-900">My doctors</h1>
          <p className="text-[13px] text-[#78716C] mt-1">
            Doctors who have access to your health records
          </p>
        </div>
        <Link
          to="/doctors"
          className="text-[13px] font-medium px-4 py-2 rounded-sm"
          style={{
            background: 'rgba(14,165,233,0.20)',
            border: '0.5px solid rgba(14,165,233,0.45)',
            color: '#0284C7',
          }}
        >
          + Find doctor
        </Link>
      </div>

      {/* Active connections */}
      {active.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">
            Active — {active.length}
          </div>
          <div className="space-y-3">
            {active.map((c) => (
              <GlassCard key={c.link._id} className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar name={c.doctor.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-sky-900">
                        Dr. {c.doctor.name}
                      </span>
                      <StatusPill variant="active" />
                    </div>
                    <div className="text-[13px] text-sky-600 mt-0.5">
                      {c.doctor.specialization}
                    </div>
                    <div className="text-[12px] text-[#78716C] mt-0.5">
                      {c.doctor.clinicName} · {c.doctor.city}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(c.link._id)}
                    disabled={revoking === c.link._id}
                    className="text-[12px] text-[#78716C] px-3 py-1.5 rounded-sm glass-subtle hover:text-[#991B1B] transition-colors disabled:opacity-50"
                  >
                    {revoking === c.link._id ? 'Revoking…' : 'Revoke access'}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">
            Pending — {pending.length}
          </div>
          <div className="space-y-3">
            {pending.map((c) => (
              <GlassCard key={c.link._id} className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar name={c.doctor.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-sky-900">
                        Dr. {c.doctor.name}
                      </span>
                      <StatusPill variant="pending" />
                    </div>
                    <div className="text-[13px] text-sky-600 mt-0.5">
                      {c.doctor.specialization}
                    </div>
                    <div className="text-[12px] text-[#78716C] mt-0.5">
                      Request sent · awaiting response
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(c.link._id)}
                    disabled={revoking === c.link._id}
                    className="text-[12px] text-[#78716C] px-3 py-1.5 rounded-sm glass-subtle hover:text-[#991B1B] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {connections.length === 0 && (
        <GlassCard className="p-10 text-center">
          <div className="text-[14px] font-medium text-sky-900 mb-2">No doctors connected yet</div>
          <p className="text-[13px] text-[#78716C] mb-4">
            Find a verified doctor and send a connection request to get started
          </p>
          <Link
            to="/doctors"
            className="inline-block text-[13px] font-medium px-5 py-2.5 rounded-sm"
            style={{
              background: 'rgba(14,165,233,0.75)',
              backdropFilter: 'blur(8px)',
              border: '0.5px solid rgba(255,255,255,0.45)',
              color: '#FEF9F0',
            }}
          >
            Find a doctor
          </Link>
        </GlassCard>
      )}
    </div>
  );
};
