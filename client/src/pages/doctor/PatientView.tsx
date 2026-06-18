import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, MessageSquare, Heart, FileText, Pill, Calendar, HeartPulse, User, Play, Pause, ExternalLink } from 'lucide-react';
import apiClient from '../../lib/apiClient';

// Import ChartJS components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ProfileDetails {
  patientId: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  knownAllergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

interface TimelineEvent {
  id: string;
  eventType: 'CONSULTATION' | 'VITAL' | 'MEDICATION' | 'CONDITION' | 'DOCUMENT' | 'FOLLOWUP';
  timestamp: string | number;
  title: string;
  notes?: string;
  status?: string;
  priority?: string;
  initiatedBy?: string;
  checkinTopic?: string;
  symptomAudioUrl?: string;
  doctorResponseAudioUrl?: string;
  callRecordingUrl?: string;
  fileUrl?: string;
  data: any;
}

export const PatientView = () => {
  const { id } = useParams();

  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<'IDLE' | 'PLAYING' | 'PAUSED'>('IDLE');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const getStreamUrl = (url: string) => {
    if (!url) return '';
    const token = localStorage.getItem('token');
    return token ? `${url}?token=${token}` : url;
  };

  const handlePlayAudio = (url: string) => {
    if (!audioPlayerRef.current) return;

    if (playingUrl === url) {
      if (audioState === 'PLAYING') {
        audioPlayerRef.current.pause();
        setAudioState('PAUSED');
      } else {
        audioPlayerRef.current.play();
        setAudioState('PLAYING');
      }
    } else {
      setPlayingUrl(url);
      audioPlayerRef.current.src = getStreamUrl(url);
      audioPlayerRef.current.play();
      setAudioState('PLAYING');
    }
  };

  const loadPatientDossier = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, timelineRes] = await Promise.all([
        apiClient.get(`/patients/${id}/profile`),
        apiClient.get(`/patients/${id}/timeline`),
      ]);
      setProfile(profileRes.data);
      setEvents(timelineRes.data);
    } catch (err: any) {
      console.error('Failed to load patient dossier:', err);
      setError('Failed to fetch patient dossier records. Ensure ACTIVE relationship link exists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientDossier();
  }, [id]);

  useEffect(() => {
    if (selectedFilter === 'ALL') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter((e) => e.eventType === selectedFilter));
    }
  }, [selectedFilter, events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CONSULTATION':
        return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case 'VITAL':
        return <HeartPulse className="w-5 h-5 text-emerald-400" />;
      case 'MEDICATION':
        return <Pill className="w-5 h-5 text-amber-500" />;
      case 'CONDITION':
        return <Heart className="w-5 h-5 text-rose-500" />;
      case 'DOCUMENT':
        return <FileText className="w-5 h-5 text-purple-400" />;
      case 'FOLLOWUP':
        return <Calendar className="w-5 h-5 text-indigo-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'CONSULTATION':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'VITAL':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'MEDICATION':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      case 'CONDITION':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'DOCUMENT':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'FOLLOWUP':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  // Compile vitals for ChartJS plotting
  const vitalsEvents = events
    .filter((e) => e.eventType === 'VITAL')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Chronological order for plotting

  const datesLabels = vitalsEvents.map((v) => new Date(v.timestamp).toLocaleDateString());

  // Blood Pressure Chart Configuration
  const bpData = {
    labels: datesLabels,
    datasets: [
      {
        label: 'Systolic BP (mmHg)',
        data: vitalsEvents.map((v) => v.data.bpSystolic),
        borderColor: '#10b981', // Emerald
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: 4,
      },
      {
        label: 'Diastolic BP (mmHg)',
        data: vitalsEvents.map((v) => v.data.bpDiastolic),
        borderColor: '#06b6d4', // Cyan
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: 4,
      },
    ],
  };

  // Glucose & Heart Rate Chart Configuration
  const hrGlucoseData = {
    labels: datesLabels,
    datasets: [
      {
        label: 'Fasting Glucose (mg/dL)',
        data: vitalsEvents.map((v) => v.data.bloodGlucoseFasting),
        borderColor: '#f59e0b', // Amber
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
      },
      {
        label: 'Post-Meal Glucose (mg/dL)',
        data: vitalsEvents.map((v) => v.data.bloodGlucosePostMeal),
        borderColor: '#a855f7', // Purple
        backgroundColor: 'rgba(168, 85, 247, 0.05)',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
      },
      {
        label: 'Heart Rate (bpm)',
        data: vitalsEvents.map((v) => v.data.heartRate),
        borderColor: '#f43f5e', // Rose
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8', // slate-400
          font: { size: 11, weight: 'bold' },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b' },
      },
    },
  };

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/doctor/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-sans text-slate-100">Clinical Dossier</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Patient: <span className="font-semibold text-slate-300">{profile?.name || 'Loading...'}</span>
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="text-center py-12 text-xs text-rose-400 border border-rose-500/10 bg-rose-500/5 rounded-2xl">
          {error}
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-xs text-slate-500 animate-pulse">
          Loading patient dossier...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Demographics Profile */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-850">
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/20 text-primary-500 rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm font-sans">{profile?.name}</h3>
                  <span className="text-xs text-slate-500">{profile?.email}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-350">
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span className="text-slate-200 font-semibold">{profile?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>DOB / Age:</span>
                  <span className="text-slate-200 font-semibold">
                    {profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gender:</span>
                  <span className="text-slate-200 font-semibold capitalize">{profile?.gender?.toLowerCase() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Blood Group:</span>
                  <span className="text-slate-200 font-extrabold text-primary-500">{profile?.bloodGroup || 'N/A'}</span>
                </div>
                
                <div className="pt-2.5 border-t border-slate-850 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Known Allergies</span>
                  <span className={`block font-semibold p-2 rounded-lg border text-xs ${
                    profile?.knownAllergies
                      ? 'bg-rose-500/10 border-rose-500/15 text-rose-400'
                      : 'bg-slate-900 border-slate-850 text-slate-400'
                  }`}>
                    {profile?.knownAllergies || 'No allergies recorded.'}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-850 space-y-1 text-slate-400">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Emergency Contact</span>
                  <p className="text-slate-200 font-semibold text-xs mt-0.5">{profile?.emergencyContactName}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{profile?.emergencyContactPhone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Vitals trends & Timeline history */}
          <div className="lg:col-span-2 space-y-8">
            {/* Vitals Graph trends (ChartJS line plots) */}
            {vitalsEvents.length > 0 && (
              <div className="glass-panel border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-md">
                <h3 className="text-sm font-bold font-sans text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <HeartPulse className="w-5 h-5 text-emerald-400" />
                  <span>Clinical Vitals Graphs</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* BP trend line */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 text-center">Blood Pressure Trend</h4>
                    <div className="h-56 relative bg-slate-950/20 border border-slate-850 p-2 rounded-xl">
                      <Line data={bpData} options={chartOptions} />
                    </div>
                  </div>

                  {/* Glucose & Heart Rate trend line */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 text-center">Glucose & Heart Rate Trend</h4>
                    <div className="h-56 relative bg-slate-950/20 border border-slate-850 p-2 rounded-xl">
                      <Line data={hrGlucoseData} options={chartOptions} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline history feed */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-bold font-sans text-slate-200 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span>Chronological Health History</span>
                </h3>

                {/* Filter Toolbar */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'All', value: 'ALL' },
                    { label: 'Consults', value: 'CONSULTATION' },
                    { label: 'Vitals', value: 'VITAL' },
                    { label: 'Meds', value: 'MEDICATION' },
                    { label: 'Conditions', value: 'CONDITION' },
                    { label: 'Docs', value: 'DOCUMENT' },
                  ].map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setSelectedFilter(f.value)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                        selectedFilter === f.value
                          ? 'bg-primary-500 border-primary-500 text-dark-950 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="glass-panel rounded-2xl p-10 border border-slate-800/80 text-center text-xs text-slate-500">
                  No records exist for the chosen filter.
                </div>
              ) : (
                <div className="relative border-l border-slate-850 ml-4 pl-5 space-y-4">
                  {filteredEvents.map((e) => (
                    <div key={e.id} className="relative group animate-fade-in">
                      {/* Icon point */}
                      <div className="absolute -left-[32px] top-1.5 p-1.5 bg-slate-900 border border-slate-850 rounded-full group-hover:border-primary-500 transition-colors z-10">
                        {getEventIcon(e.eventType)}
                      </div>

                      {/* Content panel */}
                      <div className="glass-panel border-slate-850/80 p-4 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-200">{e.title}</span>
                            <span className={`px-1.5 py-0.5 border rounded-full text-[8px] font-semibold uppercase ${getEventBadgeClass(e.eventType)}`}>
                              {e.eventType}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500">
                            {new Date(e.timestamp).toLocaleDateString()}
                          </span>
                        </div>

                        {e.notes && (
                          <p className="text-slate-450 italic">"{e.notes}"</p>
                        )}

                        {/* Consultation response / symptom audio */}
                        {e.eventType === 'CONSULTATION' && (
                          <div className="pt-2 flex flex-wrap gap-2 items-center text-[10px] text-slate-500">
                            <span>Status: <strong className="text-slate-400 uppercase">{e.status?.replace('_', ' ')}</strong></span>
                            
                            {e.symptomAudioUrl && (
                              <button
                                onClick={() => handlePlayAudio(e.symptomAudioUrl!)}
                                className="flex items-center space-x-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 text-[9px] font-bold text-blue-400 hover:text-blue-300 rounded-md cursor-pointer transition-colors animate-fade-in"
                              >
                                {playingUrl === e.symptomAudioUrl && audioState === 'PLAYING' ? (
                                  <Pause className="w-2.5 h-2.5" />
                                ) : (
                                  <Play className="w-2.5 h-2.5" />
                                )}
                                <span>Symptom Audio</span>
                              </button>
                            )}

                            {e.doctorResponseAudioUrl && (
                              <button
                                onClick={() => handlePlayAudio(e.doctorResponseAudioUrl!)}
                                className="flex items-center space-x-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 rounded-md cursor-pointer transition-colors animate-fade-in"
                              >
                                {playingUrl === e.doctorResponseAudioUrl && audioState === 'PLAYING' ? (
                                  <Pause className="w-2.5 h-2.5" />
                                ) : (
                                  <Play className="w-2.5 h-2.5" />
                                )}
                                <span>Doctor Response Audio</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Vitals specs display */}
                        {e.eventType === 'VITAL' && (
                          <div className="flex flex-wrap gap-1.5 pt-1 text-[9px]">
                            {e.data.bpSystolic && (
                              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-md">
                                BP: {e.data.bpSystolic}/{e.data.bpDiastolic} mmHg
                              </span>
                            )}
                            {e.data.bloodGlucoseFasting && (
                              <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/15 text-teal-400 rounded-md">
                                Fasting Glucose: {e.data.bloodGlucoseFasting} mg/dL
                              </span>
                            )}
                            {e.data.bloodGlucosePostMeal && (
                              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 rounded-md">
                                Post-Meal Glucose: {e.data.bloodGlucosePostMeal} mg/dL
                              </span>
                            )}
                            {e.data.heartRate && (
                              <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/15 text-rose-400 rounded-md">
                                Heart: {e.data.heartRate} bpm
                              </span>
                            )}
                          </div>
                        )}

                        {/* Secure document scanning streaming link */}
                        {e.eventType === 'DOCUMENT' && e.fileUrl && (
                          <div className="pt-1.5">
                            <a
                              href={getStreamUrl(e.fileUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] font-bold text-purple-400 hover:text-purple-300 rounded-md transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>Stream Document Report</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global hidden audio */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => {
          setAudioState('IDLE');
          setPlayingUrl(null);
        }}
        className="hidden"
      />
    </div>
  );
};

export default PatientView;
