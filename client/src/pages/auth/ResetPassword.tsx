import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { IconLock, IconAlertCircle, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';

export const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError('Invalid request. A password reset token is required in the link URL.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('A password reset token is required.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
      });

      setSuccess(response.data.message || 'Password reset successful!');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Password reset completion failed:', err);
      setError(
        err.response?.data?.error || 
        'Failed to complete password reset. The link might be expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl border border-mist-100">
        
        <div className="text-center">
          <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Reset Password</h2>
          <p className="text-[14px] font-normal text-mist-600 mt-2">
            Enter your new secure password below.
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

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">New Password</label>
            <div className="relative">
              <IconLock className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="form-input pl-10"
                required
                disabled={loading || !token}
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Confirm New Password</label>
            <div className="relative">
              <IconLock className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="form-input pl-10"
                required
                disabled={loading || !token}
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 mt-6 cursor-pointer"
          >
            {loading ? 'Resetting Password...' : 'Save New Password'}
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

export default ResetPassword;
