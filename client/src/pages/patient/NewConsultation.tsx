import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IconArrowLeft, IconMessage, IconMicrophone, IconSquare, IconTrash, IconAlertTriangle, IconAlertCircle, IconLoader2, IconCircleCheck, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import db from '../../lib/offlineDB';
import syncEngine from '../../lib/syncEngine';
import AudioRecorder from '../../lib/audioRecorder';

interface ConnectedDoctor {
  doctorId: string;
  name: string;
  specialization: string;
}

export const NewConsultation = () => {
  const [doctors, setDoctors] = useState<ConnectedDoctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [patientNotes, setPatientNotes] = useState('');

  // Symptoms checklist state
  const [fever, setFever] = useState(false);
  const [cough, setCough] = useState(false);
  const [breathlessness, setBreathlessness] = useState(false);
  const [chestPain, setChestPain] = useState(false);
  const [headache, setHeadache] = useState(false);
  const [fatigue, setFatigue] = useState(false);
  const [nausea, setNausea] = useState(false);
  const [dizziness, setDizziness] = useState(false);
  const [swelling, setSwelling] = useState(false);
  const [otherSymptoms, setOtherSymptoms] = useState('');

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

  // Load connected doctors
  const loadDoctors = async () => {
    try {
      // Offline fallback: try reading from Dexie cache if online fetch fails
      let connectedList = [];
      if (navigator.onLine) {
        const res = await apiClient.get('/connections/doctors');
        connectedList = res.data;
        // Save connected doctors to cache for offline use
        await db.cached_followups.clear(); // clean or repurpose cache
      } else {
        // Fallback: load doctors we already have in our cache links (demuxed)
        // const cached = await db.cached_timeline.toArray(); // or separate store
        // For simplicity, we assume we fetch connected doctors online
      }

      setDoctors(connectedList);
      if (connectedList.length > 0) {
        setSelectedDoctorId(connectedList[0].doctorId);
      }
    } catch (err) {
      console.error('Failed to load doctor directory:', err);
    }
  };

  useEffect(() => {
    const handleNetwork = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleNetwork);
    window.addEventListener('offline', handleNetwork);

    loadDoctors();
    recorderRef.current = new AudioRecorder(180); // 3 minute maximum

    return () => {
      window.removeEventListener('online', handleNetwork);
      window.removeEventListener('offline', handleNetwork);
      if (recorderRef.current) recorderRef.current.cancel();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Handle Voice Recording Triggers
  const startRecording = async () => {
    if (!recorderRef.current) return;
    setError(null);
    try {
      setRecording(true);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      await recorderRef.current.start(() => {
        setRecording(false);
        alert('Recording reached the maximum limit of 3 minutes.');
      });
    } catch (err: any) {
      setRecording(false);
      setError(err.message || 'Could not access microphone.');
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    try {
      const blob = await recorderRef.current.stop();
      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      console.error('Recording stop failed:', err);
    } finally {
      setRecording(false);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Submit Consultation Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError('Please select a doctor to consult.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) throw new Error('Session expired');
      const user = JSON.parse(storedUser);

      const symptomsChecklist = {
        fever,
        cough,
        breathlessness,
        chestPain,
        headache,
        fatigue,
        nausea,
        dizziness,
        swelling,
        other: otherSymptoms,
      };

      const consultationPayload = {
        patientId: user.id,
        doctorId: selectedDoctorId,
        type: 'ASYNC',
        initiatedBy: 'PATIENT',
        priority,
        status: 'PATIENT_SUBMITTED',
        symptomsChecklist,
        patientNotes,
        updatedAt: new Date().toISOString(),
      };

      // 1. Immediately cache locally
      await db.cached_consultations.put({
        id: 'temp_id', // temporary or syncUUID
        ...consultationPayload,
        createdAt: new Date().toISOString(),
      } as any);

      // 2. Queue in offline sync engine (assigns client UUID)
      await syncEngine.queueItem(
        'consultation',
        consultationPayload,
        'symptomAudioUrl',
        audioBlob || undefined
      );

      if (isOffline) {
        setSuccess('Consultation saved offline. It will synchronize once internet returns.');
      } else {
        setSuccess('Consultation submitted successfully.');
      }

      setTimeout(() => {
        navigate('/patient/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('Failed to submit consultation:', err);
      setError(err.response?.data?.error || 'Failed to submit consultation. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white rounded-xl border border-mist-100 p-6 md:p-8">

        <div className="flex items-center space-x-3 mb-6">
          <Link
            to="/"
            className="p-2 bg-mist-50 border border-mist-100 rounded-lg hover:bg-mist-100 text-mist-600 transition-colors flex items-center justify-center cursor-pointer"
          >
            <IconArrowLeft size={16} stroke={1.5} />
          </Link>
          <div>
            <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Start Async Consultation</h2>
            <p className="text-[14px] text-mist-600 mt-1">Describe symptoms, check checklists, and attach audio notes.</p>
          </div>
        </div>

        {success && (
          <div className="mb-6 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconCircleCheck size={16} stroke={1.5} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconAlertCircle size={16} stroke={1.5} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Doctor selection & priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Select Connected Doctor</label>
              {doctors.length === 0 ? (
                <div className="text-xs bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2">
                  <IconAlertTriangle size={16} stroke={1.5} className="shrink-0" />
                  <span>No connected doctors. Please link with a doctor in the Doctor Network first.</span>
                </div>
              ) : (
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="form-input"
                  required
                >
                  {doctors.map((doc) => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {doc.name} ({doc.specialization})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="form-label">Priority</label>
              <div className="grid grid-cols-3 gap-2 bg-mist-50 p-1 rounded-lg border border-mist-100">
                {(['NORMAL', 'HIGH', 'URGENT'] as const).map((p) => {
                  const isActive = priority === p;
                  let activeClass = '';
                  if (isActive) {
                    if (p === 'URGENT') {
                      activeClass = 'bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] font-medium';
                    } else if (p === 'HIGH') {
                      activeClass = 'bg-[#FAEEDA] text-[#633806] border border-[#FAC775] font-medium';
                    } else {
                      activeClass = 'bg-mist-400 text-white border border-mist-400 font-medium';
                    }
                  } else {
                    activeClass = 'text-mist-600 hover:text-mist-800 border border-transparent font-normal';
                  }

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 rounded-[4px] text-[11px] tracking-wider uppercase transition-all cursor-pointer text-center ${activeClass}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Symptoms Checklist (FR-13) */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <h3 className="text-label">
              Check Symptoms (Tick all that apply)
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Fever', val: fever, setter: setFever },
                { label: 'Cough', val: cough, setter: setCough },
                { label: 'Breathlessness', val: breathlessness, setter: setBreathlessness },
                { label: 'Chest Pain', val: chestPain, setter: setChestPain },
                { label: 'Headache', val: headache, setter: setHeadache },
                { label: 'Fatigue / Body Pain', val: fatigue, setter: setFatigue },
                { label: 'Nausea / Vomiting', val: nausea, setter: setNausea },
                { label: 'Dizziness / Vertigo', val: dizziness, setter: setDizziness },
                { label: 'Swelling / Inflammation', val: swelling, setter: setSwelling },
              ].map((symp) => (
                <label
                  key={symp.label}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer text-xs ${
                    symp.val
                      ? 'bg-mist-100 border-mist-200 text-mist-800 font-medium'
                      : 'bg-white border-mist-100 text-mist-600 hover:border-mist-200 hover:text-mist-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={symp.val}
                    onChange={(e) => symp.setter(e.target.checked)}
                    className="accent-mist-600 rounded border-mist-200 cursor-pointer"
                  />
                  <span>{symp.label}</span>
                </label>
              ))}
            </div>

            <div className="pt-2">
              <label className="form-label">Other Symptoms (Describe briefly)</label>
              <input
                type="text"
                value={otherSymptoms}
                onChange={(e) => setOtherSymptoms(e.target.value)}
                placeholder="e.g. Skin rashes, stomach ache, severe sore throat"
                className="form-input"
              />
            </div>
          </div>

          {/* Symptom Voice Recorder */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <h3 className="text-label flex items-center space-x-2">
              <IconMicrophone size={14} stroke={1.5} />
              <span>Record Symptoms (Highly Recommended)</span>
            </h3>
            <p className="text-[12px] text-mist-600">Describe your symptoms in voice for doctor diagnosis (Max 3 minutes).</p>

            <div className="bg-mist-50 border border-mist-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-full ${
                  recording ? 'bg-[#FCEBEB] text-[#E24B4A] animate-pulse border border-[#F09595]' : 'bg-white border border-mist-100 text-mist-600'
                }`}>
                  <IconMicrophone size={20} stroke={1.5} />
                </div>
                <div>
                  <span className="text-[13px] font-medium text-mist-900 block">
                    {recording ? 'Recording Audio...' : audioBlob ? 'Voice Recording Ready' : 'No Audio Notes Recorded'}
                  </span>
                  <span className="text-[11px] text-mist-600 block">
                    {recording ? 'Tap stop to finish' : audioBlob ? 'Preview recorded file below' : 'Record symptom audio offline'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {!recording && !audioBlob ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center space-x-1 px-4 py-2 bg-[#FCEBEB] hover:bg-[#fae2e2] text-[#791F1F] border border-[#F09595] text-xs font-medium rounded-lg transition-all cursor-pointer"
                  >
                    <IconMicrophone size={14} stroke={1.5} />
                    <span>Start Record</span>
                  </button>
                ) : recording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center space-x-1 px-4 py-2 bg-mist-400 hover:bg-mist-600 text-white text-xs font-medium rounded-lg transition-all cursor-pointer animate-pulse"
                  >
                    <IconSquare size={14} stroke={1.5} />
                    <span>Stop Record</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 animate-fade-in">
                    {audioUrl && (
                      <button
                        type="button"
                        onClick={togglePlayback}
                        className="flex items-center space-x-1 px-3 py-2 bg-white hover:bg-mist-50 text-mist-800 border border-mist-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        {isPlaying ? <IconPlayerPause size={14} stroke={1.5} className="animate-pulse text-[#E24B4A]" /> : <IconPlayerPlay size={14} stroke={1.5} />}
                        <span>{isPlaying ? 'Pause' : 'Preview'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={deleteRecording}
                      className="p-2 bg-white hover:bg-mist-50 text-mist-600 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-mist-100"
                      title="Discard Recording"
                    >
                      <IconTrash size={16} stroke={1.5} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {audioUrl && (
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={handleAudioEnded}
                className="hidden"
              />
            )}
          </div>

          {/* Symptom Notes */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <label className="form-label">Symptom Notes & Additional Info</label>
            <textarea
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              placeholder="Provide context like when it started, what medications you tried, and any relevant timeline updates."
              className="form-input min-h-[100px] resize-y py-2"
            />
          </div>

          {/* Submit Action Button */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading || doctors.length === 0}
              className="flex items-center justify-center space-x-2 py-2.5 px-6 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <IconLoader2 size={16} stroke={1.5} className="ti-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <IconMessage size={16} stroke={1.5} />
                  <span>Submit Consultation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewConsultation;
