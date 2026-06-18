import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconUsers, IconAlertCircle, IconClock, IconCheck, IconX, IconArrowRight, IconAlertTriangle, IconPlus, IconCalendar, IconVideo } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import Logo from '../../components/Logo';

interface PendingRequest {
  linkId: string;
  patientId: string;
  name: string;
  email: string;
  requestedAt: string;
  expiresAt: string;
}

interface ConnectedPatient {
  linkId: string;
  patientId: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  bloodGroup?: string;
  knownAllergies?: string;
  connectedAt: string;
}

interface Consultation {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    email: string;
  } | string;
  doctorId: string;
  type: 'ASYNC' | 'LIVE_CALL';
  initiatedBy: 'PATIENT' | 'DOCTOR';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: string;
  checkinTopic?: string;
  patientNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduledCall {
  _id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  estimatedDurationMin: number;
  preCallNotes?: string;
  status: string;
  consultationId: string;
  patientName: string;
  patientEmail: string;
}

export const Dashboard = () => {
  const [doctorName, setDoctorName] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [specialization, setSpecialization] = useState('');

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [connectedPatients, setConnectedPatients] = useState<ConnectedPatient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);

  const [loading, setLoading] = useState(false);
  const [actioningLinkId, setActioningLinkId] = useState<string | null>(null);

  // Vitals Check-In Modal State
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [checkinTopic, setCheckinTopic] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinDueDate, setCheckinDueDate] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinSuccess, setCheckinSuccess] = useState<string | null>(null);

  // Live Call Scheduling Modal State
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callPatientId, setCallPatientId] = useState('');
  const [callScheduledAt, setCallScheduledAt] = useState('');
  const [callDuration, setCallDuration] = useState<number>(30);
  const [callPreNotes, setCallPreNotes] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callSuccess, setCallSuccess] = useState<string | null>(null);

  const loadDoctorProfile = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;
      const loggedUser = JSON.parse(storedUser);
      setDoctorName(loggedUser.name);

      const res = await apiClient.get(`/doctors/${loggedUser.id}/profile`);
      setIsVerified(res.data.verified);
      setSpecialization(res.data.specialization);
    } catch (err) {
      console.error('Failed to load doctor profile:', err);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const requestsRes = await apiClient.get('/connections/requests');
      setPendingRequests(requestsRes.data);

      const patientsRes = await apiClient.get('/connections/patients');
      setConnectedPatients(patientsRes.data);
      if (patientsRes.data.length > 0) {
        setCallPatientId(patientsRes.data[0].patientId);
      }

      const consultsRes = await apiClient.get('/consultations');
      setConsultations(consultsRes.data);

      const callsRes = await apiClient.get('/calls');
      setScheduledCalls(callsRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorProfile();
    loadDashboardData();
  }, []);

  const handleRespond = async (linkId: string, status: 'ACTIVE' | 'DECLINED') => {
    setActioningLinkId(linkId);
    try {
      await apiClient.patch(`/connections/${linkId}/respond`, { status });
      await loadDashboardData();
    } catch (err: any) {
      console.error('Failed to respond to link request:', err);
      alert(err.response?.data?.error || 'Failed to submit response.');
    } finally {
      setActioningLinkId(null);
    }
  };

  const openCheckinModal = (patientId?: string) => {
    setSelectedPatientId(patientId || '');
    setCheckinTopic('');
    setCheckinNotes('');
    setCheckinDueDate('');
    setCheckinError(null);
    setCheckinSuccess(null);
    setCheckinModalOpen(true);
  };

  const openCallModal = (patientId?: string) => {
    setCallPatientId(patientId || (connectedPatients.length > 0 ? connectedPatients[0].patientId : ''));
    setCallScheduledAt('');
    setCallDuration(30);
    setCallPreNotes('');
    setCallError(null);
    setCallSuccess(null);
    setCallModalOpen(true);
  };

  const handleInitiateCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !checkinTopic) {
      setCheckinError('Patient and check-in topic are required.');
      return;
    }

    setCheckinLoading(true);
    setCheckinError(null);
    setCheckinSuccess(null);

    try {
      await apiClient.post('/consultations/checkin', {
        patientId: selectedPatientId,
        checkinTopic,
        doctorNotes: checkinNotes,
        dueDate: checkinDueDate || undefined,
      });

      setCheckinSuccess('Vitals check-in request initiated successfully.');
      
      const consultsRes = await apiClient.get('/consultations');
      setConsultations(consultsRes.data);

      setTimeout(() => {
        setCheckinModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to initiate vitals check-in:', err);
      setCheckinError(err.response?.data?.error || 'Failed to initiate check-in request.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleScheduleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callPatientId || !callScheduledAt) {
      setCallError('Patient and Scheduled Date/Time are required.');
      return;
    }

    setCallLoading(true);
    setCallError(null);
    setCallSuccess(null);

    try {
      await apiClient.post('/calls', {
        patientId: callPatientId,
        scheduledAt: callScheduledAt,
        estimatedDurationMin: callDuration,
        preCallNotes: callPreNotes,
      });

      setCallSuccess('Live consultation call scheduled successfully.');
      
      const callsRes = await apiClient.get('/calls');
      setScheduledCalls(callsRes.data);

      setTimeout(() => {
        setCallModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to schedule call:', err);
      setCallError(err.response?.data?.error || 'Failed to schedule live call.');
    } finally {
      setCallLoading(false);
    }
  };

  // Filter Urgent Actionable Consultations
  const urgentConsultations = consultations.filter(
    (c) => c.priority === 'URGENT' && c.status !== 'CLOSED' && c.status !== 'DOCTOR_RESPONDED'
  );

  // Filter Normal/High Consultations
  const regularConsultations = consultations.filter(
    (c) => !(c.priority === 'URGENT' && c.status !== 'CLOSED' && c.status !== 'DOCTOR_RESPONDED')
  );

  const getPatientName = (c: Consultation) => {
    if (typeof c.patientId === 'object' && c.patientId !== null) {
      return c.patientId.name;
    }
    const found = connectedPatients.find((p) => p.patientId === c.patientId);
    return found ? found.name : 'Unknown Patient';
  };

  const renderStatusPill = (status: string) => {
    let bg = 'bg-mist-50 text-mist-600';
    let dot = 'bg-mist-200';
    let text = status.replace('_', ' ');

    switch (status) {
      case 'PATIENT_SUBMITTED':
      case 'PATIENT_RESPONDED':
        bg = 'bg-[#EDF0FB] text-[#253A8A] border border-[#C8D3F5]';
        dot = 'bg-mist-400';
        break;
      case 'DOCTOR_REVIEWING':
        bg = 'bg-[#EDF0FB] text-[#253A8A] border border-[#C8D3F5]';
        dot = 'bg-mist-400';
        text = 'Reviewing';
        break;
      case 'DOCTOR_RESPONDED':
        bg = 'bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB]';
        dot = 'bg-success';
        text = 'Responded';
        break;
      case 'CLOSED':
      case 'ENDED':
        bg = 'bg-[#F1EFE8] text-[#444441] border border-[#D3D1C7]';
        dot = 'bg-neutral';
        text = 'Closed';
        break;
      case 'SCHEDULED':
      case 'ACTIVE':
        bg = 'bg-[#EDF0FB] text-[#253A8A] border border-[#C8D3F5]';
        dot = 'bg-mist-400';
        break;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase ${bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-mist-900 leading-tight">
            Welcome, <span className="text-mist-600">{doctorName}</span>
          </h1>
          <p className="text-[14px] font-normal text-mist-600 mt-1">
            {specialization ? `${specialization} Consultant` : 'Practice Dashboard'} · Continuum medical portal
          </p>
        </div>

        {isVerified && (
          <div className="flex items-center space-x-2 shrink-0">
            {connectedPatients.length > 0 && (
              <button
                onClick={() => openCallModal()}
                className="flex items-center space-x-1.5 py-2 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all cursor-pointer"
              >
                <IconVideo size={16} stroke={1.5} />
                <span>Schedule Live Call</span>
              </button>
            )}

            <button
              onClick={() => openCheckinModal()}
              disabled={connectedPatients.length === 0}
              className="flex items-center space-x-1.5 py-2 px-4 rounded-lg text-[13px] font-medium text-mist-600 bg-transparent border-1.5 border-mist-200 hover:bg-mist-50 transition-all cursor-pointer disabled:opacity-50"
            >
              <IconPlus size={16} stroke={1.5} />
              <span>Vitals Check-in</span>
            </button>
          </div>
        )}
      </div>

      {/* Verification Warnings */}
      {!isVerified && (
        <div className="bg-[#FAEEDA] border border-[#FAC775] text-[#633806] rounded-xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-[#854F0B]">
            <IconAlertCircle size={20} stroke={1.5} className="shrink-0" />
            <h3 className="font-medium text-[15px]">Medical Credentials Verification Pending</h3>
          </div>
          <p className="text-[13px] opacity-90 leading-relaxed">
            Your medical specialization license is currently under verification. Once approved by the administrator, you will be allowed to receive connection requests, review patient clinical dossiers, respond to checklists, and conduct live WebRTC video consultations.
          </p>
        </div>
      )}

      {isVerified && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Workspace Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Urgent Actions Highlights */}
            {urgentConsultations.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[12px] font-medium tracking-wider text-urgent uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-urgent animate-pulse" />
                  Urgent Actions Required ({urgentConsultations.length})
                </h3>
                <div className="space-y-3">
                  {urgentConsultations.map((c) => {
                    const patName = getPatientName(c);
                    return (
                      <div
                        key={c._id}
                        className="bg-[#FCEBEB] border border-[#F09595] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-[#F7C1C1] text-[#791F1F] text-[13px] font-medium flex items-center justify-center uppercase shrink-0">
                            {patName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[14px] font-medium text-[#791F1F]">{patName}</h4>
                              <span className="bg-urgent text-white text-[9px] font-medium px-2 py-0.25 rounded-full uppercase">
                                Urgent
                              </span>
                            </div>
                            <p className="text-[12px] text-[#791F1F]/80 mt-1 italic">
                              "{c.patientNotes || c.checkinTopic}"
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/doctor/consultations/${c._id}`}
                          className="self-end md:self-center px-4 py-2 bg-urgent hover:bg-[#c93d3d] text-white text-[13px] font-medium rounded-lg transition-all flex items-center space-x-1"
                        >
                          <span>Review Case</span>
                          <IconArrowRight size={14} stroke={1.5} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General Case Inbox */}
            <div className="space-y-3">
              <h2 className="text-[18px] font-medium text-mist-800">Clinical Consultation Inbox</h2>
              {loading && consultations.length === 0 ? (
                <div className="text-[12px] text-mist-600 animate-pulse">Loading consultations...</div>
              ) : regularConsultations.length === 0 ? (
                <div className="bg-white rounded-xl border border-mist-100 p-12 text-center">
                  <Logo color="#6B87E0" width={80} className="mx-auto mb-3" />
                  <h4 className="text-[14px] font-medium text-mist-800">Your inbox is clear</h4>
                  <p className="text-[12px] text-mist-400 mt-1">No active consultations require response at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {regularConsultations.map((c) => {
                    const patName = getPatientName(c);
                    const isHigh = c.priority === 'HIGH';
                    const bgClass = isHigh ? 'bg-[#FAEEDA]' : 'bg-[#F4F6FD]';
                    const borderClass = isHigh ? 'border-1.5 border-[#FAC775]' : 'border border-mist-100';
                    const avatarBg = isHigh ? 'bg-[#FAC775]' : 'bg-[#C8D3F5]';
                    const avatarText = isHigh ? 'text-[#633806]' : 'text-[#253A8A]';

                    return (
                      <div
                        key={c._id}
                        className={`${bgClass} ${borderClass} rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full ${avatarBg} ${avatarText} text-[13px] font-medium flex items-center justify-center uppercase shrink-0`}>
                            {patName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[14px] font-medium text-mist-900">{patName}</h4>
                              {renderStatusPill(c.status)}
                              {isHigh && (
                                <span className="bg-high text-white text-[9px] font-medium px-2 py-0.25 rounded-full uppercase">
                                  High
                                </span>
                              )}
                              {/* Cloud type chip */}
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-mist-600 bg-mist-50 border border-mist-200 px-2.5 py-0.5 rounded-full">
                                <Logo color="#6B87E0" width={14} />
                                {c.type === 'LIVE_CALL' ? 'Call' : 'Async'}
                              </span>
                            </div>
                            <p className="text-[12px] text-mist-600 mt-1 line-clamp-1 italic">
                              "{c.patientNotes || c.checkinTopic || 'No notes submitted'}"
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/doctor/consultations/${c._id}`}
                          className="self-end md:self-center px-4 py-2 bg-mist-400 hover:bg-mist-600 text-white text-[13px] font-medium rounded-lg transition-all flex items-center space-x-1"
                        >
                          <span>Open Case</span>
                          <IconArrowRight size={14} stroke={1.5} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Column (1/3 width) */}
          <div className="space-y-6">
            
            {/* Connection Requests Panel */}
            {pendingRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-mist-100 p-4 space-y-3">
                <h3 className="text-[12px] font-medium tracking-wider text-mist-600 uppercase flex items-center justify-between">
                  <span>Connection Links ({pendingRequests.length})</span>
                  <span className="w-2 h-2 rounded-full bg-high animate-pulse" />
                </h3>

                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.linkId} className="p-3 bg-mist-50 rounded-lg space-y-2">
                      <div>
                        <span className="text-[13px] font-medium text-mist-900 block">{req.name}</span>
                        <span className="text-[11px] text-mist-600 block">{req.email}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleRespond(req.linkId, 'ACTIVE')}
                          disabled={actioningLinkId !== null}
                          className="flex-1 py-1 px-2.5 rounded bg-mist-400 text-white hover:bg-mist-600 text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <IconCheck size={12} stroke={2} /> Approve
                        </button>
                        <button
                          onClick={() => handleRespond(req.linkId, 'DECLINED')}
                          disabled={actioningLinkId !== null}
                          className="py-1 px-2.5 rounded bg-transparent border border-urgent text-urgent hover:bg-[#FCEBEB] text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <IconX size={12} stroke={2} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Live Calls calendar */}
            {scheduledCalls.length > 0 && (
              <div className="bg-white rounded-xl border border-mist-100 p-4 space-y-3">
                <h3 className="text-[12px] font-medium tracking-wider text-mist-600 uppercase flex items-center gap-1.5">
                  <IconVideo size={16} stroke={1.5} />
                  <span>Scheduled Live Calls</span>
                </h3>

                <div className="space-y-2">
                  {scheduledCalls.map((call) => (
                    <div key={call._id} className="p-3 bg-mist-50 rounded-lg flex items-center justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-[12px] font-medium text-mist-900 block">{call.patientName}</span>
                        <div className="flex items-center space-x-1.5 text-[11px] text-mist-600">
                          <IconCalendar size={12} stroke={1.5} />
                          <span>{new Date(call.scheduledAt).toLocaleDateString()}</span>
                          <IconClock size={12} stroke={1.5} />
                          <span>{new Date(call.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <Link
                        to={`/call/room/${call.consultationId}`}
                        className="px-2.5 py-1.5 bg-mist-400 hover:bg-mist-600 text-white text-[11px] font-medium rounded-md transition-all flex items-center space-x-1"
                      >
                        <IconVideo size={12} stroke={1.5} />
                        <span>Join</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Patients Roster */}
            <div className="bg-white rounded-xl border border-mist-100 p-4 space-y-3">
              <h3 className="text-[12px] font-medium tracking-wider text-mist-600 uppercase flex items-center gap-1.5">
                <IconUsers size={16} stroke={1.5} />
                <span>Connected Patients ({connectedPatients.length})</span>
              </h3>

              {loading && connectedPatients.length === 0 ? (
                <div className="text-[11px] text-mist-400">Loading roster...</div>
              ) : connectedPatients.length === 0 ? (
                <div className="text-[12px] text-mist-400 text-center py-4">
                  No active clinical linkages.
                </div>
              ) : (
                <div className="divide-y divide-mist-100">
                  {connectedPatients.map((p) => (
                    <div key={p.patientId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <Link
                          to={`/doctor/patients/${p.patientId}`}
                          className="font-medium text-mist-900 hover:underline block"
                        >
                          {p.name}
                        </Link>
                        <span className="text-[10px] text-mist-600 block">
                          Connected {new Date(p.connectedAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openCheckinModal(p.patientId)}
                          title="Vitals check-in"
                          className="p-1 rounded bg-mist-50 hover:bg-mist-100 border border-mist-200 text-mist-600 cursor-pointer"
                        >
                          <IconPlus size={14} stroke={1.5} />
                        </button>
                        <button
                          onClick={() => openCallModal(p.patientId)}
                          title="Schedule Call"
                          className="p-1 rounded bg-mist-50 hover:bg-mist-100 border border-mist-200 text-mist-600 cursor-pointer"
                        >
                          <IconVideo size={14} stroke={1.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Vitals Check-in Request Modal */}
      {checkinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-white p-6 rounded-xl border border-mist-100 max-w-md w-full relative space-y-4">
            <button
              onClick={() => setCheckinModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-mist-200 hover:bg-mist-50 hover:text-mist-600 transition-all cursor-pointer"
            >
              <IconX size={16} stroke={2} />
            </button>

            <div>
              <h3 className="text-heading">Initiate Vitals Check-in</h3>
              <p className="text-caption mt-0.5">
                Send a targeted checklist request for clinical parameters.
              </p>
            </div>

            {checkinError && (
              <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg text-xs flex items-center space-x-2">
                <IconAlertTriangle size={16} stroke={1.5} />
                <span>{checkinError}</span>
              </div>
            )}

            {checkinSuccess && (
              <div className="bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] p-3 rounded-lg text-xs flex items-center space-x-2">
                <IconCheck size={16} stroke={2} />
                <span>{checkinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleInitiateCheckin} className="space-y-3">
              <div>
                <label className="form-label">Choose Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="form-input"
                  required
                  disabled={checkinLoading}
                >
                  <option value="">-- Select Patient --</option>
                  {connectedPatients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Check-in Topic / Directive</label>
                <input
                  type="text"
                  value={checkinTopic}
                  onChange={(e) => setCheckinTopic(e.target.value)}
                  placeholder="e.g. Daily Blood Pressure monitoring post beta-blocker"
                  className="form-input"
                  required
                  disabled={checkinLoading}
                />
              </div>

              <div>
                <label className="form-label">Special Directives or Notes (Optional)</label>
                <textarea
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
                  placeholder="e.g. Please log vitals twice daily (morning fasting and evening)."
                  className="form-input h-20 pt-1.5"
                  disabled={checkinLoading}
                />
              </div>

              <div>
                <label className="form-label">Due Date (Optional)</label>
                <input
                  type="date"
                  value={checkinDueDate}
                  onChange={(e) => setCheckinDueDate(e.target.value)}
                  className="form-input"
                  disabled={checkinLoading}
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCheckinModalOpen(false)}
                  className="px-4 py-2 bg-transparent border-1.5 border-mist-200 text-mist-600 text-xs font-medium rounded-lg hover:bg-mist-50 transition-colors cursor-pointer"
                  disabled={checkinLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkinLoading}
                  className="px-4 py-2 bg-mist-400 hover:bg-mist-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {checkinLoading ? 'Sending...' : 'Request Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Call Scheduling Modal */}
      {callModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-white p-6 rounded-xl border border-mist-100 max-w-md w-full relative space-y-4">
            <button
              onClick={() => setCallModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-mist-200 hover:bg-mist-50 hover:text-mist-600 transition-all cursor-pointer"
            >
              <IconX size={16} stroke={2} />
            </button>

            <div>
              <h3 className="text-heading">Schedule Live Call</h3>
              <p className="text-caption mt-0.5">
                Set up a face-to-face audio/video teleconsultation room.
              </p>
            </div>

            {callError && (
              <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg text-xs flex items-center space-x-2">
                <IconAlertTriangle size={16} stroke={1.5} />
                <span>{callError}</span>
              </div>
            )}

            {callSuccess && (
              <div className="bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] p-3 rounded-lg text-xs flex items-center space-x-2">
                <IconCheck size={16} stroke={2} />
                <span>{callSuccess}</span>
              </div>
            )}

            <form onSubmit={handleScheduleCall} className="space-y-3">
              <div>
                <label className="form-label">Select Connected Patient</label>
                <select
                  value={callPatientId}
                  onChange={(e) => setCallPatientId(e.target.value)}
                  className="form-input"
                  required
                  disabled={callLoading}
                >
                  <option value="">-- Choose Patient --</option>
                  {connectedPatients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={callScheduledAt}
                  onChange={(e) => setCallScheduledAt(e.target.value)}
                  className="form-input"
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  disabled={callLoading}
                />
              </div>

              <div>
                <label className="form-label">Duration</label>
                <select
                  value={callDuration}
                  onChange={(e) => setCallDuration(parseInt(e.target.value))}
                  className="form-input"
                  disabled={callLoading}
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="form-label">Call notes / context (Optional)</label>
                <textarea
                  value={callPreNotes}
                  onChange={(e) => setCallPreNotes(e.target.value)}
                  placeholder="Provide details on target concerns to check during the live call."
                  className="form-input h-20 pt-1.5"
                  disabled={callLoading}
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  className="px-4 py-2 bg-transparent border-1.5 border-mist-200 text-mist-600 text-xs font-medium rounded-lg hover:bg-mist-50 transition-colors cursor-pointer"
                  disabled={callLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={callLoading}
                  className="px-4 py-2 bg-mist-400 hover:bg-mist-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {callLoading ? 'Scheduling...' : 'Schedule Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
