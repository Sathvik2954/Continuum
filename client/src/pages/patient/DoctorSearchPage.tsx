import React, { useState, useCallback } from 'react';
import api from '../../lib/apiClient';
import { Avatar } from '../../components/ui/Avatar';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatusPill } from '../../components/ui/StatusPill';

interface Doctor {
  userId: string;
  name: string;
  specialization: string;
  clinicName: string;
  city: string;
  registrationNumber: string;
  verified: boolean;
}

type RequestState = Record<string, 'idle' | 'loading' | 'sent' | 'error'>;

export const DoctorSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [city, setCity] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestStates, setRequestStates] = useState<RequestState>({});

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (specialization) params.set('specialization', specialization);
      if (city) params.set('city', city);

      const res = await api.get(`/doctors/search?${params.toString()}`);
      setDoctors(res.data.doctors);
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [query, specialization, city]);

  const sendRequest = async (doctorId: string) => {
    setRequestStates((prev) => ({ ...prev, [doctorId]: 'loading' }));
    try {
      await api.post('/connections/request', { doctorId });
      setRequestStates((prev) => ({ ...prev, [doctorId]: 'sent' }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr.response?.data?.error || 'error';
      if (msg.includes('already')) {
        setRequestStates((prev) => ({ ...prev, [doctorId]: 'sent' }));
      } else {
        setRequestStates((prev) => ({ ...prev, [doctorId]: 'error' }));
        setTimeout(() => {
          setRequestStates((prev) => ({ ...prev, [doctorId]: 'idle' }));
        }, 3000);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-24">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">Find a doctor</h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          Search verified doctors and send a connection request
        </p>
      </div>

      {/* Search form */}
      <GlassCard className="p-5 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
              Name, specialization, or clinic
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Dr. Meera, Cardiology, Apollo…"
              className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Specialization
              </label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g. Endocrinology"
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Hyderabad"
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-sm text-[14px] font-medium text-cream-50 transition-opacity disabled:opacity-60"
            style={{
              background: 'rgba(14,165,233,0.75)',
              backdropFilter: 'blur(8px)',
              border: '0.5px solid rgba(255,255,255,0.45)',
            }}
          >
            {loading ? 'Searching…' : 'Search doctors'}
          </button>
        </form>
      </GlassCard>

      {/* Results */}
      {searched && !loading && (
        <div>
          {doctors.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <div className="text-[14px] font-medium text-sky-900 mb-1">No doctors found</div>
              <p className="text-[13px] text-[#78716C]">
                Try a different name, specialization, or city
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">
                {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} found
              </div>
              {doctors.map((doctor) => {
                const state = requestStates[doctor.userId] ?? 'idle';
                return (
                  <GlassCard key={doctor.userId} className="p-4 card-hover" hover>
                    <div className="flex items-center gap-4">
                      <Avatar name={doctor.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-medium text-sky-900">
                            Dr. {doctor.name}
                          </span>
                          <StatusPill variant="verified" />
                        </div>
                        <div className="text-[13px] text-sky-600 mt-0.5">
                          {doctor.specialization}
                        </div>
                        <div className="text-[12px] text-[#78716C] mt-0.5">
                          {doctor.clinicName} · {doctor.city}
                        </div>
                      </div>

                      {/* Connect button */}
                      <div className="flex-shrink-0">
                        {state === 'sent' ? (
                          <StatusPill variant="pending" label="Request sent" />
                        ) : state === 'error' ? (
                          <StatusPill variant="revoked" label="Failed — retry" />
                        ) : (
                          <button
                            onClick={() => sendRequest(doctor.userId)}
                            disabled={state === 'loading'}
                            className="text-[13px] font-medium px-4 py-2 rounded-sm disabled:opacity-50 transition-opacity"
                            style={{
                              background: 'rgba(14,165,233,0.20)',
                              border: '0.5px solid rgba(14,165,233,0.45)',
                              color: '#0284C7',
                            }}
                          >
                            {state === 'loading' ? 'Sending…' : 'Connect'}
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Initial empty state */}
      {!searched && (
        <GlassCard className="p-10 text-center">
          <div className="text-[14px] font-medium text-sky-900 mb-1">
            Search for a verified doctor
          </div>
          <p className="text-[13px] text-[#78716C]">
            Enter a name, specialization, or city above to get started
          </p>
        </GlassCard>
      )}
    </div>
  );
};
