import React, { useEffect, useState } from 'react';
import api from '../../lib/apiClient';
import { GlassCard } from '../../components/ui/GlassCard';

interface DoctorAnalytics {
  totalPatients: number;
  consultationsByStatus: Record<string, number>;
  avgResponseHours: number;
  followUpCompletionRate: number;
  topConditions: { name: string; count: number }[];
  totalCalls: number;
  totalCallMinutes: number;
}

export const DoctorAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DoctorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/analytics/doctor')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/analytics/doctor/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'continuum-patients.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <GlassCard className="p-8 text-center text-[14px] text-sky-900">Loading analytics…</GlassCard>
      </div>
    );
  }

  const totalConsultations = Object.values(data.consultationsByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-sky-900">Your analytics</h1>
          <p className="text-[13px] text-[#78716C] mt-1">Overview of your patient practice</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-[12px] font-medium px-4 py-2 rounded-sm glass-subtle text-sky-600 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : '⬇ Export patients'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <GlassCard className="p-4">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Patients</div>
          <div className="text-[24px] font-medium text-sky-900">{data.totalPatients}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Consultations</div>
          <div className="text-[24px] font-medium text-sky-900">{totalConsultations}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Avg response</div>
          <div className="text-[24px] font-medium text-sky-900">{data.avgResponseHours}h</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-1">Follow-up rate</div>
          <div className="text-[24px] font-medium text-sky-900">{data.followUpCompletionRate}%</div>
        </GlassCard>
      </div>

      {/* Consultations by status */}
      <GlassCard className="p-5 mb-5">
        <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">
          Consultations by status
        </div>
        <div className="space-y-2">
          {Object.entries(data.consultationsByStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-[13px] text-sky-900 capitalize">{status.replace(/_/g, ' ').toLowerCase()}</span>
              <span className="text-[13px] font-medium text-sky-600">{count}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Top conditions */}
      {data.topConditions.length > 0 && (
        <GlassCard className="p-5 mb-5">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">
            Top conditions across your patients
          </div>
          <div className="space-y-2">
            {data.topConditions.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="text-[13px] text-sky-900">{c.name}</span>
                <span className="text-[13px] font-medium text-sky-600">{c.count} patient{c.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Calls */}
      <GlassCard className="p-5">
        <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-3">Live calls</div>
        <div className="flex gap-6">
          <div>
            <div className="text-[20px] font-medium text-sky-900">{data.totalCalls}</div>
            <div className="text-[12px] text-[#78716C]">Total calls</div>
          </div>
          <div>
            <div className="text-[20px] font-medium text-sky-900">{data.totalCallMinutes}</div>
            <div className="text-[12px] text-[#78716C]">Total minutes</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
