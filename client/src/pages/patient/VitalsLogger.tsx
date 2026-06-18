import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IconArrowLeft, IconActivity, IconCircleCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import db from '../../lib/offlineDB';
import syncEngine from '../../lib/syncEngine';

export const VitalsLogger = () => {
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bloodGlucoseFasting, setBloodGlucoseFasting] = useState('');
  const [bloodGlucosePostMeal, setBloodGlucosePostMeal] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate that at least one vital reading is entered
    if (!bpSystolic && !bpDiastolic && !bloodGlucoseFasting && !bloodGlucosePostMeal && !heartRate && !weightKg) {
      setError('Please record at least one vital metric.');
      setLoading(false);
      return;
    }

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) throw new Error('User session expired');
      const user = JSON.parse(storedUser);

      const vitalsPayload = {
        patientId: user.id,
        recordedAt: Date.now(),
        bpSystolic: bpSystolic ? parseInt(bpSystolic) : undefined,
        bpDiastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
        bloodGlucoseFasting: bloodGlucoseFasting ? parseInt(bloodGlucoseFasting) : undefined,
        bloodGlucosePostMeal: bloodGlucosePostMeal ? parseInt(bloodGlucosePostMeal) : undefined,
        heartRate: heartRate ? parseInt(heartRate) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        notes: notes || '',
        updatedAt: new Date().toISOString(),
      };

      // 1. Save to local Dexie cache
      await db.cached_vitals.put({
        ...vitalsPayload,
        syncStatus: 'pending',
      } as any);

      // 2. Queue in outbound sync engine
      await syncEngine.queueItem('vitals', vitalsPayload);

      const isOffline = !navigator.onLine;
      if (isOffline) {
        setSuccess('Vitals saved offline. They will synchronize when internet returns.');
      } else {
        setSuccess('Vitals logged and synchronized successfully.');
      }

      setTimeout(() => {
        navigate('/patient/timeline');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to save vitals:', err);
      setError('Failed to record vitals logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="bg-white rounded-xl border border-mist-100 p-6 md:p-8">

        <div className="flex items-center space-x-3 mb-6">
          <Link
            to="/patient/timeline"
            className="p-2 bg-mist-50 border border-mist-100 rounded-lg hover:bg-mist-100 text-mist-600 transition-colors flex items-center justify-center cursor-pointer"
          >
            <IconArrowLeft size={16} stroke={1.5} />
          </Link>
          <div>
            <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Log Vitals</h2>
            <p className="text-[14px] text-mist-600 mt-1">Record your current blood pressure, glucose, or weight trends.</p>
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
            <IconAlertTriangle size={16} stroke={1.5} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Blood Pressure */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <h3 className="text-label">
              Blood Pressure
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  placeholder="e.g. 120"
                  className="form-input"
                  min="50"
                  max="250"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="form-label text-xs">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  placeholder="e.g. 80"
                  className="form-input"
                  min="30"
                  max="150"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Blood Glucose */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <h3 className="text-label">
              Blood Glucose
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">Fasting Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={bloodGlucoseFasting}
                  onChange={(e) => setBloodGlucoseFasting(e.target.value)}
                  placeholder="e.g. 90"
                  className="form-input"
                  min="20"
                  max="600"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="form-label text-xs">Post-Meal Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={bloodGlucosePostMeal}
                  onChange={(e) => setBloodGlucosePostMeal(e.target.value)}
                  placeholder="e.g. 140"
                  className="form-input"
                  min="20"
                  max="600"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Heart Rate & Weight */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <h3 className="text-label">
              Heart & Weight Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  placeholder="e.g. 72"
                  className="form-input"
                  min="35"
                  max="220"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="form-label text-xs">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="e.g. 70.5"
                  className="form-input"
                  min="2"
                  max="500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3 pt-4 border-t border-mist-100">
            <label className="form-label">Notes or Symptoms context</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Felt slightly dizzy before checking glucose. Recorded after 8 hours of sleep."
              className="form-input min-h-[80px] resize-y py-2"
              disabled={loading}
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2.5 px-6 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <IconLoader2 size={16} stroke={1.5} className="ti-spin" />
                  <span>Saving Vitals...</span>
                </>
              ) : (
                <>
                  <IconActivity size={16} stroke={1.5} />
                  <span>Log Vitals</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VitalsLogger;
