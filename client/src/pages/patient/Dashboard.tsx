import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconUser, IconHeart, IconAlertCircle, IconFileText, IconSearch, IconPlus, IconRefresh, IconTrash, IconShieldX, IconMessage, IconArrowRight, IconVideo, IconCalendar, IconClock, IconX, IconCheck } from '@tabler/icons-react';
import db, { type SyncQueueItem, type CachedConsultation, type CachedFollowup } from '../../lib/offlineDB';
import syncEngine from '../../lib/syncEngine';
import apiClient from '../../lib/apiClient';
import Logo from '../../components/Logo';

interface ConnectedDoctor {
  linkId: string;
  doctorId: string;
  name: string;
  email: string;
  specialization: string;
  clinicName: string;
  city: string;
  connectedAt: string;
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
  doctorName: string;
  doctorEmail: string;
  specialization: string;
  clinicName: string;
}

export const Dashboard = () => {
  const [patientName, setPatientName] = useState('');
  const [failedSyncs, setFailedSyncs] = useState<SyncQueueItem[]>([]);
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoctor[]>([]);
  const [consultations, setConsultations] = useState<CachedConsultation[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [followups, setFollowups] = useState<CachedFollowup[]>([]);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingConsults, setLoadingConsults] = useState(false);
  const [revokingLinkId, setRevokingLinkId] = useState<string | null>(null);

  // Live Call Scheduling States
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [preCallNotes, setPreCallNotes] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callSuccess, setCallSuccess] = useState<string | null>(null);

  // Follow-Up Completion States
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedFollowupId, setSelectedFollowupId] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [completingLoading, setCompletingLoading] = useState(false);
  const [completingError, setCompletingError] = useState<string | null>(null);

  const loadData = async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setPatientName(user.name);
      
      // Load cached consultations from Dexie (Offline-First)
      const cachedConsults = await db.cached_consultations
        .where('patientId')
        .equals(user.id)
        .toArray();
      cachedConsults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setConsultations(cachedConsults);

      // Load cached follow-ups from Dexie (Offline-First)
      const cachedFollowups = await db.cached_followups
        .where('patientId')
        .equals(user.id)
        .toArray();
      cachedFollowups.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
      setFollowups(cachedFollowups);
    }

    // Load failed items from local sync queue
    const failed = await db.sync_queue.where('syncStatus').equals('failed').toArray();
    setFailedSyncs(failed);
  };

  const loadConnectedDoctors = async () => {
    if (!navigator.onLine) return;
    setLoadingDoctors(true);
    try {
      const res = await apiClient.get('/connections/doctors');
      setConnectedDoctors(res.data);
      if (res.data.length > 0) {
        setSelectedDocId(res.data[0].doctorId);
      }
    } catch (err) {
      console.error('Failed to load connected doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadConsultations = async () => {
    if (!navigator.onLine) return;
    setLoadingConsults(true);
    try {
      const res = await apiClient.get('/consultations');
      const serverConsults = res.data;
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        
        // Cache server records in IndexedDB Dexie
        await db.transaction('rw', db.cached_consultations, async () => {
          for (const consult of serverConsults) {
            await db.cached_consultations.put({
              id: consult._id,
              patientId: consult.patientId,
              doctorId: consult.doctorId,
              type: consult.type,
              initiatedBy: consult.initiatedBy,
              priority: consult.priority,
              status: consult.status,
              checkinTopic: consult.checkinTopic,
              symptomsChecklist: consult.symptomsChecklist,
              patientNotes: consult.patientNotes,
              symptomAudioUrl: consult.symptomAudioUrl,
              doctorResponseAudioUrl: consult.doctorResponseAudioUrl,
              doctorNotes: consult.doctorNotes,
              callScheduledAt: consult.callScheduledAt,
              callRecordingUrl: consult.callRecordingUrl,
              followUpDate: consult.followUpDate,
              createdAt: consult.createdAt,
              updatedAt: consult.updatedAt,
            });
          }
        });

        // Refresh state
        const cachedConsults = await db.cached_consultations
          .where('patientId')
          .equals(user.id)
          .toArray();
        cachedConsults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setConsultations(cachedConsults);
      }
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoadingConsults(false);
    }
  };

  const loadScheduledCalls = async () => {
    if (!navigator.onLine) return;
    try {
      const res = await apiClient.get('/calls');
      setScheduledCalls(res.data);
    } catch (err) {
      console.error('Failed to load scheduled calls:', err);
    }
  };

  const loadFollowups = async () => {
    if (!navigator.onLine) return;
    try {
      const res = await apiClient.get('/followups/patient');
      const serverFollowups = res.data;
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const mapped = serverFollowups.map((item: any) => ({
          id: item._id,
          patientId: item.patientId,
          consultationId: item.consultationId,
          doctorId: typeof item.doctorId === 'object' && item.doctorId ? item.doctorId._id : item.doctorId,
          doctorName: typeof item.doctorId === 'object' && item.doctorId ? item.doctorId.name : 'Unknown Doctor',
          scheduledDate: item.scheduledDate,
          type: item.type,
          notes: item.notes,
          completed: item.completed,
          completedAt: item.completedAt,
          completionNotes: item.completionNotes,
        }));

        await db.transaction('rw', db.cached_followups, async () => {
          await db.cached_followups.clear();
          for (const item of mapped) {
            await db.cached_followups.put(item);
          }
        });

        // Refresh state
        const cached = await db.cached_followups
          .where('patientId')
          .equals(user.id)
          .toArray();
        cached.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
        setFollowups(cached);
      }
    } catch (err) {
      console.error('Failed to load patient follow-ups:', err);
    }
  };

  const handleCompleteFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowupId) return;

    setCompletingLoading(true);
    setCompletingError(null);

    try {
      if (navigator.onLine) {
        const res = await apiClient.patch(`/followups/${selectedFollowupId}/complete`, {
          completionNotes,
        });
        
        const item = res.data;
        const mappedItem = {
          id: item._id,
          patientId: item.patientId,
          consultationId: item.consultationId,
          doctorId: typeof item.doctorId === 'object' && item.doctorId ? item.doctorId._id : item.doctorId,
          doctorName: followups.find(f => f.id === selectedFollowupId)?.doctorName || 'Unknown Doctor',
          scheduledDate: item.scheduledDate,
          type: item.type,
          notes: item.notes,
          completed: item.completed,
          completedAt: item.completedAt,
          completionNotes: item.completionNotes,
        };
        await db.cached_followups.put(mappedItem);
      } else {
        const localItem = await db.cached_followups.get(selectedFollowupId);
        if (localItem) {
          const completedAt = new Date().toISOString();
          
          await syncEngine.queueItem('followup_completion', {
            id: selectedFollowupId,
            completedAt,
            completionNotes,
          });

          localItem.completed = true;
          localItem.completedAt = completedAt;
          localItem.completionNotes = completionNotes;
          await db.cached_followups.put(localItem);
        }
      }

      setCompleteModalOpen(false);
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const cached = await db.cached_followups
          .where('patientId')
          .equals(user.id)
          .toArray();
        cached.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
        setFollowups(cached);
      }
    } catch (err: any) {
      console.error('Failed to complete follow-up check-in:', err);
      setCompletingError(err.response?.data?.error || 'Failed to process completion.');
    } finally {
      setCompletingLoading(false);
    }
  };

  useEffect(() => {
    const handleNetwork = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        loadConnectedDoctors();
        loadConsultations();
        loadScheduledCalls();
        loadFollowups();
      }
    };
    window.addEventListener('online', handleNetwork);
    window.addEventListener('offline', handleNetwork);

    loadData();
    loadConnectedDoctors();
    loadConsultations();
    loadScheduledCalls();
    loadFollowups();

    const interval = setInterval(loadData, 3000);

    return () => {
      window.removeEventListener('online', handleNetwork);
      window.removeEventListener('offline', handleNetwork);
      clearInterval(interval);
    };
  }, []);

  const handleRetry = async (id: string) => {
    await syncEngine.retryFailedItem(id);
  };

  const handleDiscard = async (id: string) => {
    if (confirm('Are you sure you want to discard these offline edits?')) {
      await syncEngine.discardFailedItem(id);
    }
  };

  const handleRevoke = async (linkId: string) => {
    if (confirm("Are you sure you want to revoke this doctor's access to your medical history immediately?")) {
      setRevokingLinkId(linkId);
      try {
        await apiClient.delete(`/connections/${linkId}`);
        await loadConnectedDoctors();
      } catch (err: any) {
        console.error('Failed to revoke access link:', err);
        alert(err.response?.data?.error || 'Failed to revoke access.');
      } finally {
        setRevokingLinkId(null);
      }
    }
  };

  const handleScheduleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !scheduledAt) {
      setCallError('Doctor and Scheduled Date/Time are required.');
      return;
    }

    setCallLoading(true);
    setCallError(null);
    setCallSuccess(null);

    try {
      await apiClient.post('/calls', {
        doctorId: selectedDocId,
        scheduledAt,
        estimatedDurationMin: duration,
        preCallNotes,
      });
      setCallSuccess('Live consultation scheduled successfully.');
      loadScheduledCalls();
      setPreCallNotes('');
      setScheduledAt('');
      
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
            Hello, <span className="text-mist-600">{patientName}</span>
          </h1>
          <p className="text-[14px] font-normal text-mist-600 mt-1">Own your health. Keep track of your medical care timeline.</p>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          {isOnline && connectedDoctors.length > 0 && (
            <button
              onClick={() => {
                setCallSuccess(null);
                setCallError(null);
                setCallModalOpen(true);
              }}
              className="flex items-center justify-center space-x-1.5 py-2 px-4 rounded-lg text-[13px] font-medium text-mist-600 bg-transparent border-1.5 border-mist-200 hover:bg-mist-50 transition-all cursor-pointer font-sans"
            >
              <IconVideo size={16} stroke={1.5} />
              <span>Schedule Live Call</span>
            </button>
          )}

          <Link
            to="/patient/new-consultation"
            className="flex items-center justify-center space-x-1.5 py-2 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all font-sans"
          >
            <IconPlus size={16} stroke={1.5} />
            <span>New Consultation</span>
          </Link>
        </div>
      </div>

      {/* Sync Error Alert Panel */}
      {failedSyncs.length > 0 && (
        <div className="bg-[#FCEBEB] border border-[#F09595] rounded-xl p-4 space-y-2 text-[#791F1F]">
          <div className="flex items-center space-x-2">
            <IconAlertCircle size={18} stroke={1.5} className="shrink-0" />
            <h3 className="font-medium text-[14px]">Offline Synchronizations Failed</h3>
          </div>
          <p className="text-[12px] opacity-90 leading-relaxed">
            The following edits could not be synchronized to the servers. You can manually retry them when connection recovers or discard.
          </p>

          <div className="divide-y divide-rose-300/20 pt-1">
            {failedSyncs.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide">
                    {item.type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] opacity-70 block">ID: {item.id}</span>
                  <span className="text-[11px] font-medium block mt-0.5">{item.errorMessage}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRetry(item.id!)}
                    disabled={!isOnline}
                    className="p-1.5 bg-white border border-[#F09595] rounded hover:bg-[#FCEBEB] text-[#791F1F] transition-colors disabled:opacity-50 cursor-pointer"
                    title="Retry Sync"
                  >
                    <IconRefresh size={14} stroke={1.5} />
                  </button>
                  <button
                    onClick={() => handleDiscard(item.id!)}
                    className="p-1.5 bg-white border border-[#F09595] rounded hover:bg-[#FCEBEB] text-urgent transition-colors cursor-pointer"
                    title="Discard Edits"
                  >
                    <IconTrash size={14} stroke={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Navigation Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/patient/profile"
          className="bg-white p-5 rounded-xl border border-mist-100 glass-panel-interactive flex flex-col space-y-3"
        >
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconUser size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Health Profile</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">Configure emergency contacts, allergies, and blood group.</p>
          </div>
        </Link>

        <Link
          to="/patient/timeline"
          className="bg-white p-5 rounded-xl border border-mist-100 glass-panel-interactive flex flex-col space-y-3"
        >
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconFileText size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Health Timeline</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">Explore prescriptions, lab results, and logged vitals.</p>
          </div>
        </Link>

        <Link
          to="/patient/doctors"
          className="bg-white p-5 rounded-xl border border-mist-100 glass-panel-interactive flex flex-col space-y-3"
        >
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconSearch size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Doctor Network</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">Search verified physicians, connect, and manage access links.</p>
          </div>
        </Link>

        <div className="bg-white p-5 rounded-xl border border-mist-100 flex flex-col space-y-3 cursor-default">
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconHeart size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Quick Status</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">Offline clinical cache updates dynamically once connection is verified.</p>
          </div>
        </div>
      </div>

      {/* Upcoming Scheduled Live Calls */}
      {scheduledCalls.length > 0 && (
        <div className="bg-[#E1F5EE] border border-[#9FE1CB] rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-[#085041]">
            <IconVideo size={18} stroke={1.5} className="animate-pulse" />
            <h3 className="font-medium text-[13px] uppercase tracking-wider">Upcoming Scheduled Live Consultations</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scheduledCalls.map((call) => (
              <div key={call._id} className="p-3 bg-white border border-[#9FE1CB] rounded-lg flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium text-[13px] text-mist-900">{call.doctorName}</h4>
                  <span className="text-[11px] text-[#085041] block">{call.specialization} · {call.clinicName}</span>
                  <div className="flex items-center space-x-2 mt-1 text-[11px] text-mist-600">
                    <IconCalendar size={12} stroke={1.5} />
                    <span>{new Date(call.scheduledAt).toLocaleDateString()}</span>
                    <IconClock size={12} stroke={1.5} />
                    <span>{new Date(call.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <Link
                  to={`/call/room/${call.consultationId}`}
                  className="px-3 py-1.5 bg-[#1D9E75] hover:bg-[#157a5b] text-white text-xs font-medium rounded-lg transition-all shrink-0 flex items-center space-x-1"
                >
                  <IconVideo size={12} stroke={1.5} />
                  <span>Join Call</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Follow-Up Trackers */}
      {followups.length > 0 && (
        <div className="bg-white rounded-xl border border-mist-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-mist-600">
              <IconCalendar size={18} stroke={1.5} />
              <h3 className="font-medium text-[14px]">My Care Follow-Ups & Check-Ins</h3>
            </div>
            <span className="text-[11px] text-mist-600 bg-mist-50 border border-mist-100 px-2.5 py-0.5 rounded-full font-medium">
              Pending: {followups.filter(f => !f.completed).length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {followups.map((f) => (
              <div key={f.id} className="p-4 bg-mist-50 border border-mist-100 rounded-lg flex flex-col justify-between gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide mb-1.5 ${
                      f.type === 'LIVE_CALL'
                        ? 'bg-[#FCEBEB] text-[#791F1F]'
                        : f.type === 'VITALS_CHECK'
                        ? 'bg-[#E1F5EE] text-[#085041]'
                        : 'bg-[#EDF0FB] text-[#253A8A]'
                    }`}>
                      {f.type.replace('_', ' ')}
                    </span>
                    <h4 className="font-medium text-[13px] text-mist-900">With {f.doctorName}</h4>
                    {f.notes && <p className="text-[12px] text-mist-650 mt-1 italic">"{f.notes}"</p>}
                  </div>
                  
                  {f.completed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#085041] bg-[#E1F5EE] border border-[#9FE1CB] px-2.5 py-0.5 rounded-full shrink-0">
                      <IconCheck size={12} stroke={2} />
                      Completed
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedFollowupId(f.id);
                        setCompletionNotes('');
                        setCompletingError(null);
                        setCompleteModalOpen(true);
                      }}
                      className="px-3 py-1 bg-mist-400 hover:bg-mist-600 text-white text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer animate-pulse-subtle"
                    >
                      Log Check-in
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-mist-100 flex items-center justify-between text-[11px] text-mist-400">
                  <span>Scheduled Date:</span>
                  <span className="font-medium text-mist-800">
                    {new Date(f.scheduledDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>

                {f.completed && f.completionNotes && (
                  <div className="mt-1.5 text-[11px] bg-white p-2 rounded border border-mist-100 text-mist-950 font-normal">
                    <strong className="text-mist-600 font-medium">My Notes: </strong>{f.completionNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Consultations & Doctor Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Consultations Column (Left - 2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-[18px] font-medium text-mist-850 flex items-center space-x-2">
            <IconMessage size={18} className="text-mist-600" stroke={1.5} />
            <span>My Consultations ({consultations.length})</span>
          </h2>

          {loadingConsults && consultations.length === 0 ? (
            <div className="text-[12px] text-mist-400 animate-pulse">Loading consultations...</div>
          ) : consultations.length === 0 ? (
            <div className="bg-white rounded-xl border border-mist-100 p-12 text-center">
              <Logo color="#6B87E0" width={80} className="mx-auto mb-3" />
              <h4 className="text-[14px] font-medium text-mist-800">No consultations yet</h4>
              <p className="text-[12px] text-mist-400 mt-1">Initiate a consultation or connect to a physician to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultations.map((c) => {
                const isUrgent = c.priority === 'URGENT';
                const bgClass = isUrgent ? 'bg-[#FCEBEB]' : 'bg-white';
                const borderClass = isUrgent ? 'border-1.5 border-[#F09595]' : 'border border-mist-100';

                return (
                  <div
                    key={c.id}
                    className={`${bgClass} ${borderClass} rounded-xl p-4 hover:border-mist-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderStatusPill(c.status)}
                        {isUrgent && (
                          <span className="px-2 py-0.5 bg-urgent text-white text-[9px] font-medium rounded-full uppercase">
                            Urgent
                          </span>
                        )}
                        {/* Cloud type chip */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-mist-600 bg-mist-50 border border-mist-200 px-2.5 py-0.5 rounded-full">
                          <Logo color="#6B87E0" width={14} />
                          {c.type === 'LIVE_CALL' ? 'Call' : 'Async'}
                        </span>
                      </div>
                      <p className="text-[11px] text-mist-400">
                        Initiated: {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-[13px] font-normal text-mist-900 mt-1">
                        {c.patientNotes ? c.patientNotes.substring(0, 100) + (c.patientNotes.length > 100 ? '...' : '') : c.checkinTopic || 'Consultation details'}
                      </p>
                    </div>
                    
                    <div className="shrink-0 flex items-center justify-end sm:justify-start">
                      <span className="p-1.5 bg-mist-50 border border-mist-100 rounded text-mist-600 hover:text-mist-800">
                        <IconArrowRight size={14} stroke={1.5} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Connected Doctor Network Panel (Right - 1/3 width) */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-[18px] font-medium text-mist-850 flex items-center space-x-2">
            <IconUser size={18} className="text-mist-600" stroke={1.5} />
            <span>Connected Doctors ({connectedDoctors.length})</span>
          </h2>

          {loadingDoctors ? (
            <div className="text-[11px] text-mist-400">Loading directory...</div>
          ) : !isOnline ? (
            <div className="bg-white rounded-xl border border-mist-100 p-6 text-center text-[12px] text-mist-450">
              Offline. Roster hidden until connection is re-established.
            </div>
          ) : connectedDoctors.length === 0 ? (
            <div className="bg-white rounded-xl border border-mist-100 p-8 text-center text-[12px] text-mist-450">
              No active doctor links.{' '}
              <Link to="/patient/doctors" className="text-mist-600 font-medium hover:underline">
                Search Network
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedDoctors.map((doc) => (
                <div
                  key={doc.doctorId}
                  className="bg-white rounded-xl border border-mist-100 p-4 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h4 className="font-medium text-mist-900">{doc.name}</h4>
                    <span className="text-[10px] text-mist-600 block">{doc.specialization}</span>
                  </div>

                  <button
                    onClick={() => handleRevoke(doc.linkId)}
                    disabled={revokingLinkId === doc.linkId}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-[#FCEBEB] border border-[#F09595] text-[#791F1F] hover:bg-[#fae2e2] rounded text-[10px] font-medium cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <IconShieldX size={12} stroke={1.5} />
                    <span>Revoke</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                Book a face-to-face video teleconsultation room.
              </p>
            </div>

            {callError && (
              <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg text-xs flex items-center space-x-2">
                <IconAlertCircle size={16} stroke={1.5} />
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
                <label className="form-label">Choose Connected Doctor</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="form-input"
                  required
                  disabled={callLoading}
                >
                  {connectedDoctors.map((doc) => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {doc.name} ({doc.specialization})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="form-input"
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  disabled={callLoading}
                />
              </div>

              <div>
                <label className="form-label">Estimated Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
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
                <label className="form-label">Pre-Call symptoms / context (Optional)</label>
                <textarea
                  value={preCallNotes}
                  onChange={(e) => setPreCallNotes(e.target.value)}
                  placeholder="Provide brief details on what you want to consult with the doctor."
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
                  className="px-4 py-2 bg-mist-400 hover:bg-mist-600 text-white text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {callLoading ? 'Scheduling...' : 'Schedule Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-Up Completion Modal */}
      {completeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-white p-6 rounded-xl border border-mist-100 max-w-md w-full relative space-y-4">
            <button
              onClick={() => setCompleteModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-mist-200 hover:bg-mist-50 hover:text-mist-600 transition-all cursor-pointer"
            >
              <IconX size={16} stroke={2} />
            </button>

            <div>
              <h3 className="text-heading">Log Check-in / Complete Follow-up</h3>
              <p className="text-caption mt-0.5">
                Provide clinical updates or feedback requested by your doctor.
              </p>
            </div>

            {completingError && (
              <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg text-xs flex items-center space-x-2">
                <IconAlertCircle size={16} stroke={1.5} />
                <span>{completingError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteFollowup} className="space-y-3">
              <div>
                <label className="form-label">Completion / Care Notes</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Record your vitals, symptoms since last check, or any questions for the doctor."
                  className="form-input h-24 pt-1.5"
                  required
                  disabled={completingLoading}
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 bg-transparent border-1.5 border-mist-200 text-mist-600 text-xs font-medium rounded-lg hover:bg-mist-50 transition-colors cursor-pointer"
                  disabled={completingLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completingLoading}
                  className="px-4 py-2 bg-mist-400 hover:bg-mist-600 text-white text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {completingLoading ? 'Saving...' : 'Complete Check-in'}
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
