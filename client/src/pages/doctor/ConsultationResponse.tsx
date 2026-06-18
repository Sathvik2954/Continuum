import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Mic, Square, Trash2, CheckCircle, AlertCircle, Loader2, Plus, X, Heart, Calendar } from 'lucide-react';
import apiClient from '../../lib/apiClient';
import AudioRecorder from '../../lib/audioRecorder';

interface MedicationRow {
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

interface ConditionRow {
  conditionName: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  status: 'ACTIVE' | 'RESOLVED';
  notes: string;
}

interface ConsultationDetails {
  id: string;
  patientId: string;
  doctorId: string;
  priority: string;
  status: string;
  symptomsChecklist?: any;
  patientNotes?: string;
  symptomAudioUrl?: string;
  doctorResponseAudioUrl?: string;
  doctorNotes?: string;
  followUpDate?: string;
}

export const ConsultationResponse = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState<ConsultationDetails | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientProfile, setPatientProfile] = useState<any>(null);

  // Response inputs
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Audio response state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSymptomPlaying, setIsSymptomPlaying] = useState(false);

  // Lists inputs
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [chronicConditions, setChronicConditions] = useState<ConditionRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const symptomAudioRef = useRef<HTMLAudioElement | null>(null);

  const loadDetails = async () => {
    try {
      const res = await apiClient.get(`/consultations/${id}`);
      const data = res.data;
      setConsultation(data.consultation);
      setPatientName(data.patientName);

      // Pre-fill doctor notes if already responding
      setDoctorNotes(data.consultation.doctorNotes || '');
      if (data.consultation.followUpDate) {
        setFollowUpDate(new Date(data.consultation.followUpDate).toISOString().split('T')[0]);
      }

      // Pre-fill chronic conditions from consultation history
      setChronicConditions(data.conditions.map((c: any) => ({
        conditionName: c.conditionName,
        severity: c.severity,
        status: c.status,
        notes: c.notes || '',
      })));

      // Load patient health profile summary
      const profileRes = await apiClient.get(`/patients/${data.consultation.patientId}/profile`);
      setPatientProfile(profileRes.data);
    } catch (err: any) {
      console.error('Failed to load consultation detail:', err);
      setError('Failed to load consultation records.');
    }
  };

  useEffect(() => {
    loadDetails();
    recorderRef.current = new AudioRecorder(300); // 5 minute maximum response

    return () => {
      if (recorderRef.current) recorderRef.current.cancel();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [id, audioUrl]);

  // Symptom audio triggers
  const toggleSymptomPlay = () => {
    if (!symptomAudioRef.current) return;
    if (isSymptomPlaying) {
      symptomAudioRef.current.pause();
      setIsSymptomPlaying(false);
    } else {
      symptomAudioRef.current.play();
      setIsSymptomPlaying(true);
    }
  };

  // Response audio triggers
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
        alert('Recording reached the maximum limit of 5 minutes.');
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

  // Medication Prescription Helpers
  const addMedicationRow = () => {
    setMedications([
      ...medications,
      { medicineName: '', dosage: '', frequency: 'Twice daily', durationDays: 5, instructions: 'Take after food' },
    ]);
  };

  const removeMedicationRow = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedicationRow = (index: number, field: keyof MedicationRow, value: any) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  // Chronic Conditions Helpers
  const addConditionRow = () => {
    setChronicConditions([
      ...chronicConditions,
      { conditionName: '', severity: 'MILD', status: 'ACTIVE', notes: '' },
    ]);
  };

  const removeConditionRow = (index: number) => {
    setChronicConditions(chronicConditions.filter((_, i) => i !== index));
  };

  const updateConditionRow = (index: number, field: keyof ConditionRow, value: any) => {
    const updated = [...chronicConditions];
    updated[index] = { ...updated[index], [field]: value };
    setChronicConditions(updated);
  };

  // Submit response
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalAudioUrl = '';

      // 1. If audio recorded, upload it first (FR-22)
      if (audioBlob) {
        const formData = new FormData();
        formData.append('file', audioBlob, `doctor_response_${id}.webm`);
        formData.append('type', 'consultation');

        const uploadResponse = await apiClient.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        finalAudioUrl = uploadResponse.data.url;
      }

      // 2. Submit consultation response payload
      await apiClient.post(`/consultations/${id}/respond`, {
        doctorNotes,
        doctorResponseAudioUrl: finalAudioUrl || undefined,
        medications,
        followUpDate: followUpDate || undefined,
        chronicConditions,
      });

      setSuccess('Response submitted and synchronized successfully.');
      
      setTimeout(() => {
        navigate('/doctor/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('Failed to submit response:', err);
      setError(err.response?.data?.error || 'Failed to submit response. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to="/doctor/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-primary-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-sans text-slate-100">Respond to Consultation</h1>
            <p className="text-xs text-slate-400">Patient: <span className="font-semibold text-slate-300">{patientName}</span></p>
          </div>
        </div>

        {consultation?.priority === 'URGENT' && (
          <span className="px-3 py-1 bg-rose-500 text-slate-100 text-xs font-extrabold rounded-full glow-rose tracking-wider uppercase">
            URGENT
          </span>
        )}
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-primary-500 p-4 rounded-lg flex items-center space-x-3 text-sm animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-lg flex items-center space-x-3 text-sm animate-shake">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Patient Symptoms & Profile (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Symptoms Checklist */}
          {consultation && (
            <div className="glass-panel border-slate-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold text-primary-500 uppercase tracking-wider font-sans border-b border-slate-800 pb-2">
                Symptoms Checklist
              </h3>
              
              <div className="space-y-2">
                {Object.entries(consultation.symptomsChecklist || {}).map(([key, val]) => {
                  if (key === 'other' || !val) return null;
                  return (
                    <div key={key} className="flex items-center space-x-2 text-xs text-slate-200">
                      <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                  );
                })}
                {consultation.symptomsChecklist?.other && (
                  <div className="text-xs text-slate-400 italic mt-2">
                    Other: {consultation.symptomsChecklist.other}
                  </div>
                )}
              </div>

              {/* Patient voice description */}
              {consultation.symptomAudioUrl && (
                <div className="pt-3 border-t border-slate-850">
                  <span className="text-[10px] text-slate-500 block mb-1">Patient symptom description audio:</span>
                  <button
                    type="button"
                    onClick={toggleSymptomPlay}
                    className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-850 text-xs font-semibold border border-slate-800 rounded-lg text-primary-500 hover:text-primary-400 transition-colors"
                  >
                    {isSymptomPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isSymptomPlaying ? 'Pause Description' : 'Listen Description'}</span>
                  </button>
                  <audio
                    ref={symptomAudioRef}
                    src={consultation.symptomAudioUrl}
                    onEnded={() => setIsSymptomPlaying(false)}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* Patient Health Profile Summary */}
          {patientProfile && (
            <div className="glass-panel border-slate-800/80 rounded-2xl p-5 space-y-3.5 shadow-sm text-xs">
              <h3 className="text-xs font-semibold text-primary-500 uppercase tracking-wider font-sans border-b border-slate-800 pb-2">
                Patient Health Profile
              </h3>
              
              <div className="space-y-2 text-slate-350">
                <div className="flex justify-between">
                  <span>Age / DOB:</span>
                  <span className="text-slate-200">
                    {patientProfile.dateOfBirth ? new Date(patientProfile.dateOfBirth).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gender:</span>
                  <span className="text-slate-200 capitalize">{patientProfile.gender?.toLowerCase() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Blood Group:</span>
                  <span className="text-slate-200 font-semibold">{patientProfile.bloodGroup || 'N/A'}</span>
                </div>
                <div className="flex flex-col pt-1 border-t border-slate-850">
                  <span className="text-[10px] text-slate-500">Known Allergies:</span>
                  <span className="text-slate-200 mt-0.5">{patientProfile.knownAllergies || 'None recorded'}</span>
                </div>
                <div className="flex flex-col pt-1 border-t border-slate-850">
                  <span className="text-[10px] text-slate-500">Emergency Contact:</span>
                  <span className="text-slate-200 mt-0.5">
                    {patientProfile.emergencyContactName} ({patientProfile.emergencyContactPhone})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Response Builder & prescriptions (2/3 width) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          
          {/* Voice Response Recorder */}
          <div className="glass-panel border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 font-sans tracking-wide uppercase flex items-center space-x-2">
              <Mic className="w-4 h-4 text-primary-500" />
              <span>Record response audio notes</span>
            </h3>
            <p className="text-xs text-slate-400">Record a voice prescription or diagnosis instructions for the patient (Max 5 minutes).</p>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-full ${
                  recording ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-200 block">
                    {recording ? 'Recording Response...' : audioBlob ? 'Response Voice Note Ready' : 'No Voice Response Recorded'}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {recording ? 'Tap stop to complete' : audioBlob ? 'Listen preview below' : 'Optionally record voice feedback'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {!recording && !audioBlob ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center space-x-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-slate-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Start Record</span>
                  </button>
                ) : recording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-rose-500/25 animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Record</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    {audioUrl && (
                      <button
                        type="button"
                        onClick={togglePlayback}
                        className="flex items-center space-x-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-primary-500 border border-emerald-500/20 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isPlaying ? 'Pause' : 'Preview'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={deleteRecording}
                      className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer border border-slate-750"
                      title="Discard Response Voice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {audioUrl && (
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            )}
          </div>

          {/* Medications Prescription Builder (FR-46) */}
          <div className="glass-panel border-slate-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 font-sans tracking-wide uppercase">
                Prescribe Medications
              </h3>
              <button
                type="button"
                onClick={addMedicationRow}
                className="flex items-center space-x-1 text-xs font-semibold text-primary-500 hover:text-primary-400 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Medicine</span>
              </button>
            </div>

            {medications.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-slate-850 rounded-xl">
                No medications prescribed. Click add medicine if needed.
              </div>
            ) : (
              <div className="space-y-4">
                {medications.map((med, index) => (
                  <div
                    key={index}
                    className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl space-y-3 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeMedicationRow(index)}
                      className="absolute top-2.5 right-2.5 p-1 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-500 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label text-[10px]">Medicine Name</label>
                        <input
                          type="text"
                          value={med.medicineName}
                          onChange={(e) => updateMedicationRow(index, 'medicineName', e.target.value)}
                          placeholder="e.g. Paracetamol"
                          className="form-input text-xs py-2 px-3"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => updateMedicationRow(index, 'dosage', e.target.value)}
                          placeholder="e.g. 500mg, 1 tablet"
                          className="form-input text-xs py-2 px-3"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label text-[10px]">Frequency</label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => updateMedicationRow(index, 'frequency', e.target.value)}
                          placeholder="e.g. Twice daily"
                          className="form-input text-xs py-2 px-3"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Duration (Days)</label>
                        <input
                          type="number"
                          value={med.durationDays}
                          onChange={(e) => updateMedicationRow(index, 'durationDays', parseInt(e.target.value) || 0)}
                          className="form-input text-xs py-2 px-3"
                          required
                          min={1}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Instructions</label>
                        <input
                          type="text"
                          value={med.instructions}
                          onChange={(e) => updateMedicationRow(index, 'instructions', e.target.value)}
                          placeholder="e.g. Take after food"
                          className="form-input text-xs py-2 px-3"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chronic Conditions Diagnostics (FR-44) */}
          <div className="glass-panel border-slate-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 font-sans tracking-wide uppercase flex items-center space-x-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Diagnose Chronic Conditions</span>
              </h3>
              <button
                type="button"
                onClick={addConditionRow}
                className="flex items-center space-x-1 text-xs font-semibold text-primary-500 hover:text-primary-400 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Diagnose Condition</span>
              </button>
            </div>

            {chronicConditions.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-slate-850 rounded-xl">
                No active conditions diagnosed in this consultation session.
              </div>
            ) : (
              <div className="space-y-4">
                {chronicConditions.map((cond, index) => (
                  <div
                    key={index}
                    className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl space-y-3 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeConditionRow(index)}
                      className="absolute top-2.5 right-2.5 p-1 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-500 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-1">
                        <label className="form-label text-[10px]">Condition Name</label>
                        <input
                          type="text"
                          value={cond.conditionName}
                          onChange={(e) => updateConditionRow(index, 'conditionName', e.target.value)}
                          placeholder="e.g. Diabetes Type 2"
                          className="form-input text-xs py-2 px-3"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Severity</label>
                        <select
                          value={cond.severity}
                          onChange={(e) => updateConditionRow(index, 'severity', e.target.value as any)}
                          className="form-input text-xs py-1.5 px-2.5"
                        >
                          <option value="MILD">Mild</option>
                          <option value="MODERATE">Moderate</option>
                          <option value="SEVERE">Severe</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Status</label>
                        <select
                          value={cond.status}
                          onChange={(e) => updateConditionRow(index, 'status', e.target.value as any)}
                          className="form-input text-xs py-1.5 px-2.5"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="form-label text-[10px]">Diagnosis Notes</label>
                      <input
                        type="text"
                        value={cond.notes}
                        onChange={(e) => updateConditionRow(index, 'notes', e.target.value)}
                        placeholder="e.g. Maintain fasting sugar checks daily"
                        className="form-input text-xs py-2 px-3"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Response text, follow up & submit */}
          <div className="glass-panel border-slate-800/80 rounded-2xl p-6 space-y-4">
            <div>
              <label className="form-label">Doctor Notes & Instructions</label>
              <textarea
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Submit medical advice, recommendations, or timeline descriptions..."
                className="form-input min-h-[120px] resize-y"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="form-label">Schedule Follow-up Date (Optional)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="form-input pl-10"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-lg text-sm font-semibold text-dark-950 bg-primary-500 hover:bg-primary-600 focus:outline-none transition-all font-sans cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Response...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Submit Response</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ConsultationResponse;
