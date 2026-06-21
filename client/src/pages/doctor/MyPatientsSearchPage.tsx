import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/apiClient';
import { GlassCard } from '../../components/ui/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { db, cachePatientList, searchCachedPatients, CachedPatientListEntry } from '../../lib/offlineDB';

export const MyPatientsSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<CachedPatientListEntry[]>([]);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(true);

  // Fetch fresh list when online, cache it; fall back to cache when offline
  const fetchAndCache = useCallback(async () => {
    try {
      const res = await api.get('/connections/my-patients');
      const list = res.data.patients.map((p: { patient: { _id: string; name: string; email: string } }) => ({
        patientId: p.patient._id,
        name: p.patient.name,
        email: p.patient.email,
      }));

      // Enrich with blood group from cached profiles where available
      const enriched = await Promise.all(
        list.map(async (p: { patientId: string; name: string; email: string }) => {
          const cached = await db.cached_profile.get(p.patientId);
          return { ...p, bloodGroup: cached?.bloodGroup };
        })
      );

      await cachePatientList(enriched);
      setPatients(enriched.map((p) => ({ ...p, linkStatus: 'ACTIVE' as const, cachedAt: Date.now() })));
      setOffline(false);
    } catch {
      const cached = await searchCachedPatients('');
      setPatients(cached);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAndCache(); }, [fetchAndCache]);

  // Live search — searches the IndexedDB cache directly, works fully offline
  useEffect(() => {
    const runSearch = async () => {
      const results = await searchCachedPatients(query);
      setPatients(results);
    };
    runSearch();
  }, [query]);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-sky-900">My patients</h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          {offline ? 'Offline — searching cached patient list' : 'Search by name, email, or blood group'}
        </p>
      </div>

      <div className="mb-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients…"
          className="glass-input w-full h-11 px-4 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
        />
      </div>

      {loading ? (
        <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading…</GlassCard>
      ) : patients.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="text-[14px] font-medium text-sky-900 mb-1">No patients found</div>
          <p className="text-[13px] text-[#78716C]">
            {query ? 'Try a different search term' : 'Your connected patients will appear here'}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {patients.map((p) => (
            <GlassCard
              key={p.patientId}
              className="p-4 card-hover"
              hover
              onClick={() => navigate(`/patients/${p.patientId}/timeline`)}
            >
              <div className="flex items-center gap-3">
                <Avatar name={p.name} size="md" />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-sky-900">{p.name}</div>
                  <div className="text-[12px] text-[#78716C]">
                    {p.email}{p.bloodGroup ? ` · ${p.bloodGroup}` : ''}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};
