import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';

type Role = 'PATIENT' | 'DOCTOR';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>('PATIENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '',
    // Doctor fields
    specialization: '', clinicName: '', city: '', registrationNumber: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, role });
      navigate('/onboarding');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-medium text-sky-900 tracking-widest">CONTINUUM</h1>
          <p className="text-[13px] text-[#78716C] mt-1">healthcare continuity</p>
        </div>

        <div className="glass rounded-xl p-7">
          <h2 className="text-[20px] font-medium text-sky-900 mb-1">Create account</h2>
          <p className="text-[13px] text-[#78716C] mb-5">Join CONTINUUM today</p>

          {/* Role toggle */}
          <div className="flex gap-2 mb-5 glass-subtle rounded-sm p-1">
            {(['PATIENT', 'DOCTOR'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-1.5 text-[13px] font-medium rounded-xs transition-all duration-150 ${
                  role === r
                    ? 'glass text-sky-900'
                    : 'text-[#78716C]'
                }`}
              >
                {r === 'PATIENT' ? 'Patient' : 'Doctor'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-[13px] text-[#991B1B]"
              style={{ background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.35)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Common fields */}
            <Field label="Full name" type="text" value={form.name}
              onChange={(v) => set('name', v)} placeholder="Ravi Kumar" required />
            <Field label="Email address" type="email" value={form.email}
              onChange={(v) => set('email', v)} placeholder="you@example.com" required />
            <Field label="Password" type="password" value={form.password}
              onChange={(v) => set('password', v)} placeholder="Min 8 characters" required />
            <Field label="Phone (optional)" type="tel" value={form.phone}
              onChange={(v) => set('phone', v)} placeholder="+91 98765 43210" />

            {/* Doctor-only fields */}
            {role === 'DOCTOR' && (
              <>
                <div className="pt-1">
                  <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2.5">
                    Practice details
                  </div>
                  <div className="space-y-3">
                    <Field label="Specialization" type="text" value={form.specialization}
                      onChange={(v) => set('specialization', v)} placeholder="e.g. Endocrinology" required />
                    <Field label="Clinic name" type="text" value={form.clinicName}
                      onChange={(v) => set('clinicName', v)} placeholder="Apollo Clinic" required />
                    <Field label="City" type="text" value={form.city}
                      onChange={(v) => set('city', v)} placeholder="Hyderabad" required />
                    <Field label="Registration number" type="text" value={form.registrationNumber}
                      onChange={(v) => set('registrationNumber', v)} placeholder="MCI-12345" required />
                  </div>
                </div>
              </>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-sm text-[14px] font-medium text-cream-50 transition-opacity disabled:opacity-60"
                style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </form>

          <p className="text-center text-[13px] text-[#78716C] mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-600 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Shared field component ────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, type, value, onChange, placeholder, required }) => (
  <div>
    <label className="block text-[12px] font-medium text-sky-600 mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
    />
  </div>
);
