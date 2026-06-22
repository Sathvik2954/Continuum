import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { resolveFileUrl } from '../../lib/resolveFileUrl';
import { GlassCard } from '../../components/ui/GlassCard';
import { TimelineEntryRow } from '../../components/timeline/TimelineEntryRow';
import { HealthSummaryCard } from '../../components/timeline/HealthSummaryCard';
import { VitalsLogForm } from '../../components/vitals/VitalsLogForm';
import { VitalsChart } from '../../components/vitals/VitalsChart';
import { DocumentUploadButton } from '../../components/documents/DocumentUploadButton';
import { cacheTimeline, getCachedTimeline, CachedTimelineEntry } from '../../lib/offlineDB';

type FilterType = 'all' | 'consultation' | 'condition' | 'medication' | 'vital' | 'document';

interface SummaryData {
  activeConditions: { _id: string; conditionName: string; severity: 'MILD' | 'MODERATE' | 'SEVERE'; status: 'ACTIVE' | 'RESOLVED' }[];
  activeMedications: { _id: string; medicineName: string; dosage: string; frequency: string }[];
  totalConsultations: number;
}

interface VitalPoint {
  recordedAt: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  weightKg?: number;
  heartRate?: number;
}

export const TimelinePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { patientId: routePatientId } = useParams<{ patientId?: string }>();

  const patientId = routePatientId || user?.id || '';
  const isOwnTimeline = !routePatientId;

  const [entries, setEntries] = useState<CachedTimelineEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [vitalsChartData, setVitalsChartData] = useState<VitalPoint[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const [timelineRes, summaryRes, chartRes] = await Promise.all([
        api.get(`/patients/${patientId}/timeline`),
        api.get(`/patients/${patientId}/summary`),
        api.get(`/patients/${patientId}/vitals-chart`),
      ]);

      setEntries(timelineRes.data.entries);
      setSummary(summaryRes.data);
      setVitalsChartData(chartRes.data.vitals);
      setOffline(false);

      await cacheTimeline(
        patientId,
        timelineRes.data.entries.map((e: { id: string; type: string; title: string; subtitle: string; timestamp: string; meta: Record<string, unknown> }) => ({
          id: e.id, type: e.type, title: e.title, subtitle: e.subtitle, timestamp: e.timestamp, meta: e.meta,
        }))
      );
    } catch {
      const cached = await getCachedTimeline(patientId);
      setEntries(cached);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) fetchTimeline();
  }, [patientId, fetchTimeline]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.type === filter);

  const handleEntryClick = (entry: CachedTimelineEntry) => {
    if (entry.type === 'consultation') navigate(`/consultations/${entry.id}`);
    if (entry.type === 'document') window.open(resolveFileUrl(entry.meta.fileUrl as string), '_blank');
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">
          {isOwnTimeline ? 'Your health timeline' : 'Patient health timeline'}
        </h1>
        <p className="text-[13px] text-[#78716C] mt-1">
          {offline ? 'Showing cached data - you are offline' : 'Complete chronological history, always up to date'}
        </p>
      </div>

      {summary && (
        <HealthSummaryCard
          activeConditions={summary.activeConditions}
          activeMedications={summary.activeMedications}
        />
      )}

      {/* Vitals chart + log button - patient's own timeline only */}
      {isOwnTimeline && (
        <div className="mb-5 space-y-3">
          <VitalsChart vitals={vitalsChartData} metric="bp" />
          <div className="grid grid-cols-2 gap-3">
            <VitalsChart vitals={vitalsChartData} metric="weight" />
            <VitalsChart vitals={vitalsChartData} metric="heartRate" />
          </div>
          <VitalsLogForm onLogged={fetchTimeline} />
          <DocumentUploadButton onUploaded={fetchTimeline} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 mb-5 glass-subtle rounded-sm p-1 w-fit flex-wrap">
        {([
          { key: 'all', label: 'All' },
          { key: 'consultation', label: 'Consultations' },
          { key: 'condition', label: 'Conditions' },
          { key: 'medication', label: 'Medications' },
          { key: 'vital', label: 'Vitals' },
          { key: 'document', label: 'Documents' },
        ] as { key: FilterType; label: string }[]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-xs transition-all duration-150 ${
              filter === f.key ? 'glass text-sky-900' : 'text-[#78716C]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading timeline…</GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="text-[14px] font-medium text-sky-900 mb-1">
            {filter === 'all' ? 'No history yet' : `No ${filter}s yet`}
          </div>
          <p className="text-[13px] text-[#78716C]">
            {isOwnTimeline ? 'Your health records will appear here.' : "This patient's history will appear here."}
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="p-5">
          {filtered.map((entry, i) => (
            <TimelineEntryRow
              key={entry.id}
              type={entry.type}
              title={entry.title}
              subtitle={entry.subtitle}
              timestamp={entry.timestamp}
              meta={entry.meta}
              isLast={i === filtered.length - 1}
              onClick={['consultation', 'document'].includes(entry.type) ? () => handleEntryClick(entry) : undefined}
            />
          ))}
        </GlassCard>
      )}
    </div>
  );
};
