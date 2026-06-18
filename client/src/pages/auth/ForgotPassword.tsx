import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconMail, IconAlertCircle, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLink, setTestLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email address is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setTestLink(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      setSuccess(response.data.message || 'Verification link generated.');
      
      // If server returned a token (in dev/test mode), expose the link directly to bypass mail servers
      if (response.data.token) {
        setTestLink(`/reset-password?token=${response.data.token}`);
      }
    } catch (err: any) {
      console.error('Password recovery request failed:', err);
      setError(
        err.response?.data?.error || 
        'Failed to request password reset. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl border border-mist-100">
        
        <div className="text-center">
          <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Recover Password</h2>
          <p className="text-[14px] font-normal text-mist-600 mt-2">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {error && (
          <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconAlertCircle size={16} stroke={1.5} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconCheck size={16} stroke={2} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {testLink && (
          <div className="bg-[#EDF0FB] text-[#253A8A] border border-[#C8D3F5] p-3 rounded-lg text-xs space-y-2">
            <p className="font-medium">Sandbox Mode Override:</p>
            <p className="opacity-90">To reset your password locally without a mail server, use this direct link:</p>
            <Link
              to={testLink}
              className="inline-block px-3 py-1.5 bg-mist-400 text-white rounded font-medium hover:bg-mist-600 transition-colors"
            >
              Reset Password Now
            </Link>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Email Address</label>
            <div className="relative">
              <IconMail className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="form-input pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 mt-6 cursor-pointer"
          >
            {loading ? 'Requesting Link...' : 'Send Recovery Link'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-[12px] text-mist-600 hover:text-mist-800 font-medium transition-colors"
          >
            <IconArrowLeft size={12} stroke={1.5} />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
