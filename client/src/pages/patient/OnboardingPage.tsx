import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { queueItem } from '../../lib/syncEngine';
import { db } from '../../lib/offlineDB';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/apiClient';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDERS = [
  { value: 'MALE',   label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Other' },
] as const;

export const OnboardingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    knownAllergies: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const profileData = {
      ...form,
      updatedAt: new Date().toISOString(),
    };

    // Always cache locally first
    if (user) {
      await db.cached_profile.put({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: 'PATIENT',
        ...form,
        updatedAt: new Date().toISOString(),
      });
    }

    // Try to sync immediately if online
    if (navigator.onLine) {
      try {
        await api.post('/patients/sync/profile', profileData);
        setSaved(true);
        setTimeout(() => navigate('/dashboard'), 800);
      } catch {
        // Offline or error - queue for later
        await queueItem('patient_profile', profileData);
        setSaved(true);
        setTimeout(() => navigate('/dashboard'), 800);
      }
    } else {
      // Queue for sync when online
      await queueItem('patient_profile', profileData);
      setSaved(true);
      setTimeout(() => navigate('/dashboard'), 800);
    }

    setSaving(false);
  };

  if (user?.role !== 'PATIENT') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-medium text-sky-900">Complete your health profile</h1>
          <p className="text-[13px] text-[#78716C] mt-1.5">
            This helps doctors understand your health history.
            {!navigator.onLine && (
              <span className="block mt-1 text-[#78350F]">
                You're offline - your data will sync automatically when connected.
              </span>
            )}
          </p>
        </div>

        <div className="glass rounded-xl p-7">
          <form onSubmit={handleSave} className="space-y-5">

            {/* Date of birth */}
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Date of birth
              </label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">Gender</label>
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => set('gender', g.value)}
                    className={`flex-1 py-2 text-[13px] font-medium rounded-sm transition-all duration-150 ${
                      form.gender === g.value
                        ? 'glass text-sky-900 border border-sky-200'
                        : 'glass-subtle text-[#78716C]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Blood group */}
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Blood group
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => set('bloodGroup', bg)}
                    className={`py-2 text-[13px] font-medium rounded-sm transition-all duration-150 ${
                      form.bloodGroup === bg
                        ? 'glass text-sky-900 border border-sky-200'
                        : 'glass-subtle text-[#78716C]'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Known allergies */}
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Known allergies
                <span className="text-[#A8A29E] font-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={form.knownAllergies}
                onChange={(e) => set('knownAllergies', e.target.value)}
                rows={2}
                placeholder="e.g. Penicillin, dust mites, peanuts"
                className="glass-input w-full px-3 py-2 text-[14px] text-sky-900 placeholder:text-[#A8A29E] resize-none"
              />
            </div>

            {/* Emergency contact */}
            <div>
              <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2.5">
                Emergency contact
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                    Contact name
                  </label>
                  <input
                    type="text"
                    value={form.emergencyContactName}
                    onChange={(e) => set('emergencyContactName', e.target.value)}
                    placeholder="Family member or friend"
                    className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                    Contact phone
                  </label>
                  <input
                    type="tel"
                    value={form.emergencyContactPhone}
                    onChange={(e) => set('emergencyContactPhone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 rounded-sm text-[14px] font-medium transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: saved
                    ? 'rgba(16,185,129,0.70)'
                    : 'rgba(14,165,233,0.75)',
                  backdropFilter: 'blur(8px)',
                  border: '0.5px solid rgba(255,255,255,0.45)',
                  color: '#FEF9F0',
                }}
              >
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save profile'}
              </button>
              <p className="text-center text-[12px] text-[#78716C] mt-3">
                You can update this anytime from your profile
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
