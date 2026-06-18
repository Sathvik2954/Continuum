import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { IconUser, IconMail, IconLock, IconPhone, IconAlertCircle, IconArrowRight, IconStethoscope, IconBuilding, IconMapPin, IconAward } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';

interface RegisterProps {
  setUser: (user: any) => void;
  setToken: (token: string) => void;
}

export const Register = ({ setUser, setToken }: RegisterProps) => {
  const [role, setRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Doctor-specific fields
  const [specialization, setSpecialization] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [city, setCity] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all core fields.');
      return;
    }

    if (role === 'DOCTOR' && (!specialization || !clinicName || !city || !registrationNumber)) {
      setError('Please fill in all doctor registration credentials.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        role,
        name,
        phone,
      });

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setToken(token);
      setUser(user);

      if (role === 'DOCTOR') {
        await apiClient.post('/doctors/profile', {
          specialization,
          clinicName,
          city,
          registrationNumber,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        navigate('/doctor/dashboard');
      } else {
        navigate('/patient/profile');
      }
    } catch (err: any) {
      console.error('Registration request failed:', err);
      setError(
        err.response?.data?.error || 
        'Registration failed. Please double check all fields.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-6 bg-white p-8 rounded-xl border border-mist-100">
        
        <div className="text-center">
          <h2 className="text-[22px] font-medium text-mist-900">Create Account</h2>
          <p className="text-[14px] font-normal text-mist-600 mt-2">
            Join the healthcare continuity network
          </p>

          {/* Role selector tab */}
          <div className="mt-5 p-1 bg-mist-50 border border-mist-100 rounded-lg max-w-xs mx-auto flex">
            <button
              type="button"
              onClick={() => setRole('PATIENT')}
              className={`flex-1 py-1 rounded-md text-[11px] font-medium tracking-wider transition-all uppercase ${
                role === 'PATIENT'
                  ? 'bg-mist-400 text-white'
                  : 'text-mist-600 hover:text-mist-800'
              }`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => setRole('DOCTOR')}
              className={`flex-1 py-1 rounded-md text-[11px] font-medium tracking-wider transition-all uppercase ${
                role === 'DOCTOR'
                  ? 'bg-mist-400 text-white'
                  : 'text-mist-600 hover:text-mist-800'
              }`}
            >
              Doctor
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconAlertCircle size={16} stroke={1.5} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <div className="relative">
                <IconUser className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="form-input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Phone Number (Optional)</label>
              <div className="relative">
                <IconPhone className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="form-input pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="form-label">Password</label>
              <div className="relative">
                <IconLock className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="form-input pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>

          {/* Render Doctor profile configuration fields if Role == DOCTOR */}
          {role === 'DOCTOR' && (
            <div className="border-t border-mist-100 pt-4 mt-4 space-y-4">
              <h3 className="text-[12px] font-medium text-mist-650 uppercase tracking-wider">
                Doctor Professional Verification Info
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Medical Specialization</label>
                  <div className="relative">
                    <IconStethoscope className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                    <input
                      type="text"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Cardiology, Pediatrics"
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Medical Registration License No.</label>
                  <div className="relative">
                    <IconAward className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. MCI-12345"
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Clinic / Hospital Name</label>
                  <div className="relative">
                    <IconBuilding className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="e.g. HealthCare Diagnostics"
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">City</label>
                  <div className="relative">
                    <IconMapPin className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Hyderabad"
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 mt-6 cursor-pointer"
          >
            {loading ? (
              <span>Registering account...</span>
            ) : (
              <>
                <span>Register Account</span>
                <IconArrowRight size={14} stroke={1.5} />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-[12px] text-mist-650">
          Already registered?{' '}
          <Link to="/login" className="text-mist-600 hover:text-mist-800 font-medium transition-colors">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
