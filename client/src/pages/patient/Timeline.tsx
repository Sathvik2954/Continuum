import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, MessageSquare, Heart, FileText, Pill, ShieldAlert, Play, Pause, ExternalLink, Calendar, HeartPulse } from 'lucide-react';
import apiClient from '../../lib/apiClient';
import db from '../../lib/offlineDB';

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
  followUpDate?: string;
  fileUrl?: string;
  data: any;
}

export const Timeline = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Audio Playback State
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

  const handleAudioEnded = () => {
    setAudioState('IDLE');
    setPlayingUrl(null);
  };

  const loadTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;
      const user = JSON.parse(storedUser);

      if (navigator.onLine) {
        // Fetch from server
        const res = await apiClient.get(`/patients/${user.id}/timeline`);
        const serverTimeline = res.data;
        setEvents(serverTimeline);

        // Cache timeline in Dexie
        await db.cached_timeline.put({
          patientId: user.id,
          items: serverTimeline,
          updatedAt: Date.now(),
        });
      } else {
        // Fetch from Dexie cache
        const cached = await db.cached_timeline.get(user.id);
        if (cached) {
          setEvents(cached.items);
        } else {
          setError('No cached timeline records found while offline.');
        }
      }
    } catch (err: any) {
      console.error('Failed to load timeline:', err);
      setError('Failed to retrieve timeline records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleNetwork = () => {
      setIsOffline(!navigator.onLine);
      loadTimeline();
    };
    window.addEventListener('online', handleNetwork);
    window.addEventListener('offline', handleNetwork);

    loadTimeline();

    return () => {
      window.removeEventListener('online', handleNetwork);
      window.removeEventListener('offline', handleNetwork);
    };
  }, []);

  // Filter events when selected filter or events change
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-sans">My Health Timeline</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological log of consultations, vitals, prescriptions, and diagnostics
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <Link
            to="/patient/vitals/new"
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          >
            Log Vitals
          </Link>
          <Link
            to="/patient/documents/new"
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-purple-500/30 text-purple-400 hover:text-purple-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          >
            Upload Document
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-850">
        {[
          { label: 'All History', value: 'ALL' },
          { label: 'Consultations', value: 'CONSULTATION' },
          { label: 'Vitals', value: 'VITAL' },
          { label: 'Prescriptions', value: 'MEDICATION' },
          { label: 'Conditions', value: 'CONDITION' },
          { label: 'Documents', value: 'DOCUMENT' },
          { label: 'Follow-Ups', value: 'FOLLOWUP' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setSelectedFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              selectedFilter === f.value
                ? 'bg-primary-500 border-primary-500 text-dark-950 font-bold'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Network Alert */}
      {isOffline && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-xs flex items-center space-x-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>You are viewing cached timeline records while offline. Some updates may not show until you reconnect.</span>
        </div>
      )}

      {/* Main Feed */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500 animate-pulse">
          Loading clinical timeline...
        </div>
      ) : error ? (
        <div className="text-center py-12 text-xs text-rose-400 border border-rose-500/10 bg-rose-500/5 rounded-2xl">
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 border border-slate-800/80 text-center">
          <Clock className="w-12 h-12 mx-auto text-slate-500 mb-4" />
          <h3 className="font-semibold text-lg text-slate-200">No Records Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            No history exists for the selected category filter. Click "Log Vitals" or start a new consultation to add entries.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6">
          {filteredEvents.map((e) => (
            <div key={e.id} className="relative group animate-fade-in">
              {/* Vertical Dot */}
              <div className="absolute -left-[37px] top-1.5 p-2 bg-slate-900 border border-slate-800 rounded-full group-hover:border-primary-500 transition-colors z-10">
                {getEventIcon(e.eventType)}
              </div>

              {/* Event Card */}
              <div className="glass-panel border-slate-800/85 p-5 rounded-2xl space-y-3 shadow-sm hover:border-slate-700/80 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-slate-200 font-sans">{e.title}</h3>
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wide ${getEventBadgeClass(e.eventType)}`}>
                      {e.eventType}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(e.timestamp).toLocaleDateString()} at {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {e.notes && (
                  <p className="text-xs text-slate-350 leading-relaxed italic">
                    "{e.notes}"
                  </p>
                )}

                {/* Event Type Specific Content Renderers */}
                {e.eventType === 'CONSULTATION' && (
                  <div className="pt-2.5 border-t border-slate-850/60 flex flex-wrap gap-3 items-center text-xs text-slate-400">
                    <span>Priority: <strong className={e.priority === 'URGENT' ? 'text-rose-500' : 'text-slate-300'}>{e.priority}</strong></span>
                    <span>Status: <strong className="text-slate-300 uppercase">{e.status?.replace('_', ' ')}</strong></span>
                    
                    {/* Audio Playback Buttons */}
                    {e.symptomAudioUrl && (
                      <button
                        onClick={() => handlePlayAudio(e.symptomAudioUrl!)}
                        className="flex items-center space-x-1.5 px-3 py-1 bg-slate-900 border border-slate-800 text-[10px] font-bold text-blue-400 hover:text-blue-300 rounded-lg cursor-pointer transition-colors"
                      >
                        {playingUrl === e.symptomAudioUrl && audioState === 'PLAYING' ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>Symptom Audio</span>
                      </button>
                    )}

                    {e.doctorResponseAudioUrl && (
                      <button
                        onClick={() => handlePlayAudio(e.doctorResponseAudioUrl!)}
                        className="flex items-center space-x-1.5 px-3 py-1 bg-slate-900 border border-slate-800 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 rounded-lg cursor-pointer transition-colors"
                      >
                        {playingUrl === e.doctorResponseAudioUrl && audioState === 'PLAYING' ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>Doctor Response Audio</span>
                      </button>
                    )}
                  </div>
                )}

                {e.eventType === 'VITAL' && (
                  <div className="flex flex-wrap gap-2 pt-2 text-[10px]">
                    {e.data.bpSystolic && (
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-lg font-semibold">
                        BP: {e.data.bpSystolic}/{e.data.bpDiastolic} mmHg
                      </span>
                    )}
                    {e.data.bloodGlucoseFasting && (
                      <span className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/15 text-teal-400 rounded-lg font-semibold">
                        Fasting Glucose: {e.data.bloodGlucoseFasting} mg/dL
                      </span>
                    )}
                    {e.data.bloodGlucosePostMeal && (
                      <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 rounded-lg font-semibold">
                        Post-Meal Glucose: {e.data.bloodGlucosePostMeal} mg/dL
                      </span>
                    )}
                    {e.data.heartRate && (
                      <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/15 text-rose-400 rounded-lg font-semibold">
                        Heart Rate: {e.data.heartRate} bpm
                      </span>
                    )}
                    {e.data.weightKg && (
                      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/15 text-amber-500 rounded-lg font-semibold">
                        Weight: {e.data.weightKg} kg
                      </span>
                    )}
                  </div>
                )}

                {e.eventType === 'DOCUMENT' && e.fileUrl && (
                  <div className="pt-2">
                    <a
                      href={getStreamUrl(e.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-bold text-purple-400 hover:text-purple-300 rounded-lg transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Stream Signed Document</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Hidden Audio Tag */}
      <audio
        ref={audioPlayerRef}
        onEnded={handleAudioEnded}
        className="hidden"
      />
    </div>
  );
};

export default Timeline;
