import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pb-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-medium text-sky-900 tracking-widest">CONTINUUM</h1>
          <p className="text-[13px] text-[#78716C] mt-1">healthcare continuity</p>
        </div>

        {/* Card */}
        <div className="glass rounded-xl p-7">
          <h2 className="text-[20px] font-medium text-sky-900 mb-1">Welcome back</h2>
          <p className="text-[13px] text-[#78716C] mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-[13px] text-[#991B1B]"
              style={{ background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.35)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="glass-input w-full h-10 px-3 text-[14px] text-sky-900 placeholder:text-[#A8A29E]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-sm text-[14px] font-medium text-cream-50 transition-opacity disabled:opacity-60"
              style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-[13px] text-[#78716C] mt-5">
            No account?{' '}
            <Link to="/register" className="text-sky-600 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
