import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IconMail, IconLock, IconAlertCircle, IconArrowRight } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';

interface LoginProps {
  setUser: (user: any) => void;
  setToken: (token: string) => void;
}

export const Login = ({ setUser, setToken }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credential fields.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setToken(token);
      setUser(user);

      if (user.role === 'PATIENT') {
        if (user.profileCompleted) {
          navigate('/patient/dashboard');
        } else {
          navigate('/patient/profile');
        }
      } else if (user.role === 'DOCTOR') {
        navigate('/doctor/dashboard');
      } else if (user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      console.error('Login request failed:', err);
      setError(
        err.response?.data?.error || 
        'Failed to connect to authentication server. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl border border-mist-100">
        
        <div className="text-center">
          <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Welcome Back</h2>
          <p className="text-[14px] font-normal text-mist-600 mt-2">
            Own your health. Access your medical timeline.
          </p>
        </div>

        {error && (
          <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconAlertCircle size={16} stroke={1.5} className="shrink-0" />
            <span>{error}</span>
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
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="form-label mb-0">Password</label>
              <Link
                to="/forgot-password"
                className="text-[12px] font-normal text-mist-600 hover:text-mist-800 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <IconLock className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input pl-10"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 mt-6 cursor-pointer"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In</span>
                <IconArrowRight size={14} stroke={1.5} />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-[12px] text-mist-650">
          New to Continuum?{' '}
          <Link to="/register" className="text-mist-600 hover:text-mist-800 font-medium transition-colors">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
