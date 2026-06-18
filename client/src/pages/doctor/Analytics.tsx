import { useState, useEffect } from 'react';
import { IconChartBar, IconUsers, IconClock, IconAlertTriangle, IconFileText, IconRefresh, IconFolder } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import Logo from '../../components/Logo';

interface AnalyticsData {
  totalConnectedPatients: number;
  priorityCounts: {
    NORMAL: number;
    HIGH: number;
    URGENT: number;
  };
  distribution: {
    open: number;
    closed: number;
  };
  avgResponseTimeMinutes: number;
}

export const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        setError('No logged in physician found.');
        return;
      }
      const loggedUser = JSON.parse(storedUser);
      const res = await apiClient.get(`/doctors/${loggedUser.id}/analytics`);
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load doctor practice analytics:', err);
      setError('Could not retrieve practice analytics. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalPriorityCount = data
    ? data.priorityCounts.NORMAL + data.priorityCounts.HIGH + data.priorityCounts.URGENT
    : 0;

  const totalConsultations = data
    ? data.distribution.open + data.distribution.closed
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-mist-900 tracking-tight flex items-center gap-2">
            <IconChartBar size={22} className="text-mist-600" stroke={1.5} />
            Practice Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time clinical insights, consultation volumes, response metrics, and priority tracking.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-transparent border-1.5 border-mist-200 text-mist-600 text-[13px] font-medium transition-all hover:bg-mist-50 cursor-pointer"
        >
          <IconRefresh size={14} className={loading ? 'ti-spin' : ''} stroke={1.5} />
          Refresh Stats
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[#FCEBEB] border border-[#F09595] text-[#791F1F] rounded-lg text-xs">
          <IconAlertTriangle size={16} stroke={1.5} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="bg-white rounded-xl border border-mist-100 p-16 text-center">
          <IconRefresh size={32} className="mx-auto text-mist-400 ti-spin mb-4" stroke={1.3} />
          <h3 className="font-medium text-[15px] text-mist-800">Analyzing Practice Data</h3>
          <p className="text-[12px] text-mist-400 mt-1">Aggregating patient records and response timelines...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Patients Connected */}
            <div className="bg-mist-50 p-6 rounded-[10px] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-normal text-mist-400 uppercase tracking-wider block">Connected Patients</span>
                <span className="text-[22px] font-medium text-mist-600 mt-1 block">
                  {data.totalConnectedPatients}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-mist-100 flex items-center justify-center text-mist-600">
                <IconUsers size={20} stroke={1.5} />
              </div>
            </div>

            {/* Average Response Time */}
            <div className="bg-mist-50 p-6 rounded-[10px] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-normal text-mist-400 uppercase tracking-wider block">Avg Response Time</span>
                <span className="text-[22px] font-medium text-mist-600 mt-1 block">
                  {data.avgResponseTimeMinutes > 0
                    ? data.avgResponseTimeMinutes > 120
                      ? `${Math.round(data.avgResponseTimeMinutes / 60)} hrs`
                      : `${data.avgResponseTimeMinutes} mins`
                    : 'N/A'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-mist-100 flex items-center justify-center text-mist-600">
                <IconClock size={20} stroke={1.5} />
              </div>
            </div>

            {/* Open Inboxes */}
            <div className="bg-mist-50 p-6 rounded-[10px] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-normal text-mist-400 uppercase tracking-wider block">Open Inboxes</span>
                <span className="text-[22px] font-medium text-mist-600 mt-1 block">
                  {data.distribution.open}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-mist-100 flex items-center justify-center text-mist-600">
                <IconFileText size={20} stroke={1.5} />
              </div>
            </div>

            {/* Resolved Consultations (Success theme) */}
            <div className="bg-[#E1F5EE] p-6 rounded-[10px] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-normal text-[#1D9E75] uppercase tracking-wider block">Cases Resolved</span>
                <span className="text-[22px] font-medium text-[#0F6E56] mt-1 block">
                  {data.distribution.closed}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#9FE1CB] flex items-center justify-center text-[#085041]">
                <IconFolder size={20} stroke={1.5} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority Density */}
            <div className="bg-white p-6 rounded-xl border border-mist-100">
              <h3 className="text-[15px] font-medium text-mist-600 mb-5">Consultation Priority Density</h3>
              <div className="space-y-4">
                {/* URGENT */}
                <div>
                  <div className="flex justify-between text-[11px] font-medium mb-1">
                    <span className="text-urgent flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-urgent animate-pulse" />
                      Urgent Priorities
                    </span>
                    <span className="text-mist-900 font-medium">
                      {data.priorityCounts.URGENT} / {totalPriorityCount} cases
                    </span>
                  </div>
                  <div className="w-full bg-[#FCEBEB] rounded-full h-2">
                    <div
                      className="bg-urgent h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${totalPriorityCount > 0 ? (data.priorityCounts.URGENT / totalPriorityCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* HIGH */}
                <div>
                  <div className="flex justify-between text-[11px] font-medium mb-1">
                    <span className="text-[#854F0B] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-high" />
                      High Priorities
                    </span>
                    <span className="text-mist-900 font-medium">
                      {data.priorityCounts.HIGH} / {totalPriorityCount} cases
                    </span>
                  </div>
                  <div className="w-full bg-[#FAEEDA] rounded-full h-2">
                    <div
                      className="bg-high h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${totalPriorityCount > 0 ? (data.priorityCounts.HIGH / totalPriorityCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* NORMAL */}
                <div>
                  <div className="flex justify-between text-[11px] font-medium mb-1">
                    <span className="text-[#085041] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-mist-400" />
                      Normal Priorities
                    </span>
                    <span className="text-mist-900 font-medium">
                      {data.priorityCounts.NORMAL} / {totalPriorityCount} cases
                    </span>
                  </div>
                  <div className="w-full bg-mist-50 rounded-full h-2">
                    <div
                      className="bg-mist-400 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${totalPriorityCount > 0 ? (data.priorityCounts.NORMAL / totalPriorityCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Case Completion Rate */}
            <div className="bg-white p-6 rounded-xl border border-mist-100 flex flex-col justify-between">
              <div>
                <h3 className="text-[15px] font-medium text-mist-600 mb-1">Resolution Rate</h3>
                <p className="text-mist-400 text-[12px]">Percentage of total clinical consultations successfully resolved.</p>
              </div>

              <div className="py-4 flex items-center justify-center">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[8px] border-mist-50" />
                  <div
                    className="absolute inset-0 rounded-full border-[8px] border-success border-t-transparent border-r-transparent transition-all duration-300"
                    style={{
                      transform: `rotate(${Math.min(
                        360,
                        totalConsultations > 0 ? (data.distribution.closed / totalConsultations) * 360 : 0
                      )}deg)`,
                    }}
                  />
                  <div className="text-center z-10">
                    <span className="text-[22px] font-medium text-mist-900">
                      {totalConsultations > 0
                        ? `${Math.round((data.distribution.closed / totalConsultations) * 100)}%`
                        : '0%'}
                    </span>
                    <p className="text-[9px] text-mist-400 font-medium uppercase tracking-wider mt-0.5">Resolved</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-mist-100 flex items-center justify-between text-[11px] text-mist-400">
                <span>Active Open: <strong className="text-mist-800">{data.distribution.open}</strong></span>
                <span>Archived/Closed: <strong className="text-mist-800">{data.distribution.closed}</strong></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-mist-100 p-12 text-center">
          <Logo color="#6B87E0" width={80} className="mx-auto mb-3" />
          <h3 className="font-medium text-[14px] text-mist-800">No practice analytics found</h3>
          <p className="text-[12px] text-mist-400 max-w-sm mx-auto mt-1">
            Register patient cases or conduct consultations to aggregate clinical care insights.
          </p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
