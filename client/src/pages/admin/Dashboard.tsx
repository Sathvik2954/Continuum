import { useState, useEffect } from 'react';
import { IconShield, IconUsers, IconCalendar, IconVideo, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import Logo from '../../components/Logo';

interface DoctorRow {
  userId: string;
  name: string;
  email: string;
  specialization: string;
  clinicName: string;
  city: string;
  registrationNumber: string;
  verified: boolean;
}

interface AuditLog {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    email: string;
  } | null;
  entityType: 'PROFILE' | 'CONDITION' | 'CONSULTATION' | 'MEDICATION';
  entityId: string;
  fieldChanged: string;
  oldValue?: string;
  newValue?: string;
  changedBy: {
    _id: string;
    name: string;
    email: string;
  } | null;
  changedByRole: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  changedAt: string;
}

interface PlatformAnalytics {
  totalPatients: number;
  totalDoctors: number;
  totalAdmins: number;
  activeConnections: number;
  totalConsultations: number;
  totalCalls: number;
}

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'verification' | 'audit'>('metrics');
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const res = await apiClient.get('/admin/analytics');
      setAnalytics(res.data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError('Could not retrieve platform metrics.');
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await apiClient.get('/admin/doctors');
      setDoctors(res.data);
    } catch (err: any) {
      console.error('Failed to load doctors roster:', err);
      setError('Could not retrieve physician verification records.');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await apiClient.get('/admin/audit-logs');
      setAuditLogs(res.data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError('Could not retrieve system change-log feeds.');
    }
  };

  const handleToggleVerify = async (doctorId: string, currentStatus: boolean) => {
    setActioningId(doctorId);
    try {
      await apiClient.patch(`/admin/doctors/${doctorId}/verify`, { verified: !currentStatus });
      setDoctors((prev) =>
        prev.map((doc) => (doc.userId === doctorId ? { ...doc, verified: !currentStatus } : doc))
      );
    } catch (err) {
      console.error('Verification status update failed:', err);
      alert('Could not update physician verification status.');
    } finally {
      setActioningId(null);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchAnalytics(), fetchDoctors(), fetchAuditLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-mist-900 tracking-tight flex items-center gap-2">
            <IconShield size={22} className="text-mist-600" stroke={1.5} />
            Admin Control Center
          </h1>
          <p className="text-[14px] font-normal text-mist-600 mt-1">
            Platform-wide system audits, license verifications, and operational metrics.
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-transparent border-1.5 border-mist-200 text-mist-600 text-[13px] font-medium transition-all hover:bg-mist-50 cursor-pointer"
        >
          <IconRefresh size={14} className={loading ? 'ti-spin' : ''} stroke={1.5} />
          Refresh Control Panel
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[#FCEBEB] border border-[#F09595] text-[#791F1F] rounded-lg text-xs">
          <IconAlertCircle size={16} stroke={1.5} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-mist-100 gap-1 bg-white p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 text-[13px] font-medium transition-all rounded-lg ${
            activeTab === 'metrics'
              ? 'bg-mist-50 text-mist-600'
              : 'text-neutral-500 hover:text-mist-600'
          }`}
        >
          Platform Metrics
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`px-4 py-2 text-[13px] font-medium transition-all rounded-lg ${
            activeTab === 'verification'
              ? 'bg-mist-50 text-mist-600'
              : 'text-neutral-500 hover:text-mist-600'
          }`}
        >
          Physician Verification
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-[13px] font-medium transition-all rounded-lg ${
            activeTab === 'audit'
              ? 'bg-mist-50 text-mist-600'
              : 'text-neutral-500 hover:text-mist-600'
          }`}
        >
          Security Audit Logs
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {analytics ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Accounts */}
                <div className="bg-mist-50 p-6 rounded-[10px] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-normal text-mist-400 uppercase tracking-wider block">Total Accounts</span>
                    <span className="text-[22px] font-medium text-mist-600 mt-1 block">
                      {analytics.totalPatients + analytics.totalDoctors + analytics.totalAdmins}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-mist-100 flex items-center justify-center text-mist-600">
                    <IconUsers size={20} stroke={1.5} />
                  </div>
                </div>

                {/* Total Consultations (Success Card style) */}
                <div className="bg-[#E1F5EE] p-6 rounded-[10px] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-normal text-[#1D9E75] uppercase tracking-wider block">Total Consultations</span>
                    <span className="text-[22px] font-medium text-[#0F6E56] mt-1 block">
                      {analytics.totalConsultations}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#9FE1CB] flex items-center justify-center text-[#085041]">
                    <IconCalendar size={20} stroke={1.5} />
                  </div>
                </div>

                {/* Completed Calls (Warning Card style) */}
                <div className="bg-[#FAEEDA] p-6 rounded-[10px] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-normal text-[#BA7517] uppercase tracking-wider block">Completed Calls</span>
                    <span className="text-[22px] font-medium text-[#854F0B] mt-1 block">
                      {analytics.totalCalls}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#FAC775] flex items-center justify-center text-[#633806]">
                    <IconVideo size={20} stroke={1.5} />
                  </div>
                </div>
              </div>

              {/* Ratios Info Box */}
              <div className="bg-white p-6 rounded-xl border border-mist-100">
                <h3 className="text-[15px] font-medium text-mist-600 mb-4">Platform Connection Ratio</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[12px] text-mist-600 mb-1">
                      <span>Doctor to Patient Ratio</span>
                      <span className="font-medium">
                        {analytics.totalDoctors > 0 ? (analytics.totalPatients / analytics.totalDoctors).toFixed(1) : 0} patients per doctor
                      </span>
                    </div>
                    <div className="w-full bg-mist-50 rounded-full h-2">
                      <div
                        className="bg-mist-400 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            analytics.totalDoctors > 0
                              ? (analytics.totalDoctors / (analytics.totalPatients || 1)) * 100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-mist-100 flex items-center justify-between text-[11px] text-mist-400">
                    <span>Active Clinical Links: <strong className="text-mist-800">{analytics.activeConnections}</strong></span>
                    <span>Patients: <strong className="text-mist-800">{analytics.totalPatients}</strong></span>
                    <span>Doctors: <strong className="text-mist-800">{analytics.totalDoctors}</strong></span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-[14px] text-mist-600">Loading metrics data...</div>
          )}
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="bg-white rounded-xl border border-mist-100 overflow-hidden">
          <div className="p-4.5 border-b border-mist-100">
            <h3 className="text-[15px] font-medium text-mist-600">Physician Roster</h3>
            <p className="text-mist-400 text-[12px] mt-0.5">Approve registration credentials for medical practice access.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-mist-100 text-mist-600 text-[11px] font-medium bg-mist-50 uppercase tracking-wider">
                  <th className="p-4">Physician Details</th>
                  <th className="p-4">Specialization</th>
                  <th className="p-4">Clinic & City</th>
                  <th className="p-4 font-mono">License No.</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {doctors.length > 0 ? (
                  doctors.map((doc) => (
                    <tr key={doc.userId} className="border-b border-mist-100 hover:bg-mist-50/50 text-mist-900 text-[14px] transition-all">
                      <td className="p-4">
                        <div className="font-medium text-mist-900">{doc.name}</div>
                        <div className="text-[12px] text-mist-600 mt-0.5">{doc.email}</div>
                      </td>
                      <td className="p-4">{doc.specialization}</td>
                      <td className="p-4">
                        <div>{doc.clinicName}</div>
                        <div className="text-[12px] text-mist-600">{doc.city}</div>
                      </td>
                      <td className="p-4 font-mono text-[12px] text-mist-800">{doc.registrationNumber}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center">
                          {doc.verified ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB]">
                              <span className="w-1.5 h-1.5 rounded-full bg-success" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#FAEEDA] text-[#854F0B] border border-[#FAC775]">
                              <span className="w-1.5 h-1.5 rounded-full bg-high animate-pulse" />
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleVerify(doc.userId, doc.verified)}
                          disabled={actioningId !== null}
                          className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border-1.5 transition-all cursor-pointer ${
                            doc.verified
                              ? 'bg-transparent border-urgent text-urgent hover:bg-[#FCEBEB]'
                              : 'bg-transparent border-success text-success hover:bg-[#E1F5EE]'
                          }`}
                        >
                          {actioningId === doc.userId ? (
                            '...'
                          ) : doc.verified ? (
                            'Revoke Access'
                          ) : (
                            'Approve'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Logo color="#6B87E0" width={80} className="mb-3" />
                        <h4 className="text-[14px] font-medium text-mist-800">No physician profiles</h4>
                        <p className="text-[12px] font-normal text-mist-400 mt-1">No doctor profiles found in the registry.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-mist-100 overflow-hidden">
          <div className="p-4.5 border-b border-mist-100">
            <h3 className="text-[15px] font-medium text-mist-600">Security Activity Audit Logs</h3>
            <p className="text-mist-400 text-[12px] mt-0.5">Immutable record of changes to patient profiles and clinical records.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-mist-100 text-mist-600 text-[11px] font-medium bg-mist-50 uppercase tracking-wider">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Patient Affected</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 font-mono">Field</th>
                  <th className="p-4">Old vs New Value</th>
                  <th className="p-4 text-right">Performed By</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log._id} className="border-b border-mist-100 hover:bg-mist-50/50 text-mist-900 text-[13px] transition-all">
                      <td className="p-4 text-mist-650 font-mono text-[11px]">
                        {new Date(log.changedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-mist-900">
                          {log.patientId?.name || 'Deleted Patient'}
                        </div>
                        <div className="text-[11px] text-mist-600">{log.patientId?.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-mist-50 text-mist-600 border border-mist-100">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-mist-800 font-medium">{log.fieldChanged}</td>
                      <td className="p-4 max-w-xs truncate">
                        <div className="space-y-1">
                          {log.oldValue && log.oldValue !== '{}' && (
                            <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] px-2 py-0.5 rounded text-[11px] line-through truncate">
                              {log.oldValue}
                            </div>
                          )}
                          <div className="bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] px-2 py-0.5 rounded text-[11px] truncate font-medium">
                            {log.newValue || '<empty>'}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-medium text-mist-900">
                          {log.changedBy?.name || 'System'}
                        </div>
                        <span className={`inline-block text-[9px] font-medium uppercase mt-0.5 px-2 py-0.25 rounded-full border ${
                          log.changedByRole === 'DOCTOR'
                            ? 'bg-[#EDF0FB] text-[#253A8A] border-[#C8D3F5]'
                            : log.changedByRole === 'ADMIN'
                            ? 'bg-[#F1EFE8] text-[#444441] border-[#D3D1C7]'
                            : 'bg-[#E1F5EE] text-[#085041] border-[#9FE1CB]'
                        }`}>
                          {log.changedByRole}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Logo color="#6B87E0" width={80} className="mb-3" />
                        <h4 className="text-[14px] font-medium text-mist-800">No activity audits</h4>
                        <p className="text-[12px] font-normal text-mist-400 mt-1">No system data edits have been logged yet.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
