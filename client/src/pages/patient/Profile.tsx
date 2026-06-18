import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconUser, IconCalendar, IconHeart, IconPhone, IconAlertCircle, IconDeviceFloppy, IconCircleCheck } from '@tabler/icons-react';
import db from '../../lib/offlineDB';
import syncEngine from '../../lib/syncEngine';
import apiClient from '../../lib/apiClient';

export const Profile = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [bloodGroup, setBloodGroup] = useState<'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-'>('A+');
  const [knownAllergies, setKnownAllergies] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const navigate = useNavigate();

  useEffect(() => {
    const handleNetworkChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    const loadProfile = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const loggedUser = JSON.parse(storedUser);

        setName(loggedUser.name || '');
        setEmail(loggedUser.email || '');

        // 1. Read from Dexie local cache first
        const localProfile = await db.cached_profile.get(loggedUser.id);
        if (localProfile) {
          setPhone(localProfile.phone || '');
          if (localProfile.dateOfBirth) {
            setDateOfBirth(new Date(localProfile.dateOfBirth).toISOString().split('T')[0]);
          }
          setGender(localProfile.gender || 'MALE');
          setBloodGroup(localProfile.bloodGroup || 'A+');
          setKnownAllergies(localProfile.knownAllergies || '');
          setEmergencyContactName(localProfile.emergencyContactName || '');
          setEmergencyContactPhone(localProfile.emergencyContactPhone || '');
        } else if (navigator.onLine) {
          // 2. Fetch from API if online and cache it
          const res = await apiClient.get(`/patients/${loggedUser.id}/profile`);
          const serverProf = res.data;
          
          setPhone(serverProf.phone || '');
          if (serverProf.dateOfBirth) {
            setDateOfBirth(new Date(serverProf.dateOfBirth).toISOString().split('T')[0]);
          }
          setGender(serverProf.gender || 'MALE');
          setBloodGroup(serverProf.bloodGroup || 'A+');
          setKnownAllergies(serverProf.knownAllergies || '');
          setEmergencyContactName(serverProf.emergencyContactName || '');
          setEmergencyContactPhone(serverProf.emergencyContactPhone || '');

          // Cache profile in Dexie
          await db.cached_profile.put({
            patientId: loggedUser.id,
            userId: loggedUser.id,
            name: loggedUser.name,
            email: loggedUser.email,
            phone: serverProf.phone,
            dateOfBirth: serverProf.dateOfBirth,
            gender: serverProf.gender,
            bloodGroup: serverProf.bloodGroup,
            knownAllergies: serverProf.knownAllergies,
            emergencyContactName: serverProf.emergencyContactName,
            emergencyContactPhone: serverProf.emergencyContactPhone,
            updatedAt: serverProf.updatedAt || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      }
    };

    loadProfile();

    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    setLoading(true);

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) throw new Error('User session expired');
      const loggedUser = JSON.parse(storedUser);

      const profilePayload = {
        patientId: loggedUser.id,
        userId: loggedUser.id,
        name,
        email,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        gender,
        bloodGroup,
        knownAllergies,
        emergencyContactName,
        emergencyContactPhone,
        updatedAt: new Date().toISOString(),
      };

      // 1. Immediately write to client Dexie store (Offline-First priority)
      await db.cached_profile.put(profilePayload);

      // 2. Queue in sync queue
      await syncEngine.queueItem('patient_profile', profilePayload);

      // Update user complete state in local session
      loggedUser.profileCompleted = true;
      localStorage.setItem('user', JSON.stringify(loggedUser));

      if (isOffline) {
        setSuccessMsg('Profile saved locally. Changes will sync once connection returns.');
      } else {
        setSuccessMsg('Profile saved and synchronized successfully.');
      }
      
      // Auto redirect to dashboard after delay
      setTimeout(() => {
        navigate('/patient/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('Failed to save profile changes:', err);
      setErrorMsg(err.message || 'Failed to save health profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white rounded-xl border border-mist-100 p-6 md:p-8">
        
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600">
            <IconUser size={20} stroke={1.5} />
          </div>
          <div>
            <h2 className="text-[22px] font-medium text-mist-900 leading-tight">Patient Health Profile</h2>
            <p className="text-[14px] font-normal text-mist-600 mt-1">Complete your lifelong clinical profile details below.</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-6 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconCircleCheck size={16} stroke={1.5} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
            <IconAlertCircle size={16} stroke={1.5} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Demographics */}
          <div className="space-y-4">
            <h3 className="text-label">
              1. Demographics & Account info
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Name</label>
                <input type="text" value={name} disabled className="form-input opacity-50 bg-mist-50 cursor-not-allowed" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={email} disabled className="form-input opacity-50 bg-mist-50 cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Phone Number</label>
                <div className="relative">
                  <IconPhone className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9999999999"
                    className="form-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Date of Birth</label>
                <div className="relative">
                  <IconCalendar className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="form-input pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="form-input"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Details */}
          <div className="space-y-4 pt-4 border-t border-mist-100">
            <h3 className="text-label">
              2. Clinical Info
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as any)}
                  className="form-input"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Known Allergies / Health Conditions</label>
                <div className="relative">
                  <IconHeart className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
                  <input
                    type="text"
                    value={knownAllergies}
                    onChange={(e) => setKnownAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, dust allergies, hypertension"
                    className="form-input pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Emergency Contacts */}
          <div className="space-y-4 pt-4 border-t border-mist-100">
            <h3 className="text-label">
              3. Emergency Contacts
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Contact Name</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="e.g. Spouse, parent name"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Contact Phone No.</label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2 px-6 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              <IconDeviceFloppy size={16} stroke={1.5} />
              <span>{loading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
