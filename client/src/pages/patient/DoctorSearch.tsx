import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft, IconSearch, IconUser, IconStethoscope, IconBuilding, IconMapPin, IconLoader2, IconLink, IconSend, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';

interface DoctorSearchResult {
  doctorId: string;
  name: string;
  email: string;
  specialization: string;
  clinicName: string;
  city: string;
  verified: boolean;
}

interface ConnectionRequest {
  doctorId: string;
  status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
}

export const DoctorSearch = () => {
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [city, setCity] = useState('');
  const [doctors, setDoctors] = useState<DoctorSearchResult[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionRequest>>({});

  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = async () => {
    try {
      const res = await apiClient.get('/connections/patient/requests');
      const connMap: Record<string, ConnectionRequest> = {};
      res.data.forEach((conn: any) => {
        connMap[conn.doctorId] = conn;
      });
      setConnections(connMap);
    } catch (err) {
      console.error('Failed to load patient connections:', err);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get('/doctors/search', {
        params: { name, specialization, city },
      });
      setDoctors(res.data);
    } catch (err: any) {
      console.error('Search request failed:', err);
      setError(err.response?.data?.error || 'Failed to search doctors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of connections and empty search (shows all verified doctors)
    loadConnections();
    handleSearch();
  }, []);

  const handleSendRequest = async (doctorId: string) => {
    setSendingRequest(doctorId);
    try {
      await apiClient.post('/connections/request', { doctorId });
      // Reload connection request history to update UI state
      await loadConnections();
    } catch (err: any) {
      console.error('Failed to send connection request:', err);
      alert(err.response?.data?.error || 'Failed to send request.');
    } finally {
      setSendingRequest(null);
    }
  };

  const getConnectionStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending Approval';
      case 'ACTIVE':
        return 'Connected';
      case 'DECLINED':
        return 'Declined';
      case 'REVOKED':
        return 'Access Revoked';
      case 'EXPIRED':
        return 'Request Expired';
      default:
        return 'Connect';
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <Link
          to="/"
          className="p-2 bg-mist-50 border border-mist-100 rounded-lg hover:bg-mist-100 text-mist-600 transition-colors flex items-center justify-center cursor-pointer"
        >
          <IconArrowLeft size={16} stroke={1.5} />
        </Link>
        <div>
          <h1 className="text-[22px] font-medium text-mist-900 leading-tight">Find Doctors</h1>
          <p className="text-[14px] text-mist-600 mt-1">Search and connect with medical professionals to share your health records.</p>
        </div>
      </div>

      {/* Filter Form Card */}
      <div className="bg-white rounded-xl border border-mist-100 p-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="form-label">Doctor Name</label>
            <div className="relative">
              <IconUser className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Smith"
                className="form-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Specialization</label>
            <div className="relative">
              <IconStethoscope className="absolute left-3 top-2.5 w-4 h-4 text-mist-200" stroke={1.5} />
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g. Cardiology"
                className="form-input pl-10"
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
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-[13px] font-medium text-white bg-mist-400 hover:bg-mist-600 transition-all disabled:opacity-50 cursor-pointer h-9"
          >
            {loading ? <IconLoader2 size={16} stroke={1.5} className="ti-spin" /> : <IconSearch size={16} stroke={1.5} />}
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Error messages */}
      {error && (
        <div className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] p-3 rounded-lg flex items-center space-x-2 text-xs">
          <IconAlertCircle size={16} stroke={1.5} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Search Results */}
      <div className="space-y-4">
        <h3 className="text-label">
          Search Results ({doctors.length})
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-mist-600 space-y-2">
            <IconLoader2 size={32} stroke={1.5} className="ti-spin text-mist-400" />
            <span className="text-xs text-mist-650">Searching directories...</span>
          </div>
        ) : doctors.length === 0 ? (
          <div className="bg-white rounded-xl border border-mist-100 p-12 text-center text-mist-600 text-[13px]">
            No doctors found matching the search criteria. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {doctors.map((doc) => {
              const conn = connections[doc.doctorId];
              const isPending = conn?.status === 'PENDING';
              const isActive = conn?.status === 'ACTIVE';
              const buttonText = getConnectionStatusText(conn?.status);

              return (
                <div
                  key={doc.doctorId}
                  className="bg-white rounded-xl border border-mist-100 p-5 flex flex-col justify-between hover:border-mist-200 transition-all group relative overflow-hidden"
                >
                  {/* Card content */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[15px] font-medium text-mist-900 leading-tight">
                          {doc.name}
                        </h4>
                        <span className="text-[11px] font-medium text-mist-600 uppercase tracking-wider block mt-1">
                          {doc.specialization}
                        </span>
                      </div>
                      <div className="p-2 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 group-hover:text-mist-800 group-hover:bg-mist-100 transition-all">
                        <IconUser size={18} stroke={1.5} />
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-mist-600 pt-2 border-t border-mist-100">
                      <div className="flex items-center space-x-2">
                        <IconBuilding size={14} stroke={1.5} className="text-mist-200" />
                        <span>{doc.clinicName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <IconMapPin size={14} stroke={1.5} className="text-mist-200" />
                        <span>{doc.city}</span>
                      </div>
                    </div>
                  </div>

                  {/* Connect Action Button */}
                  <div className="pt-4 mt-4 border-t border-mist-100 flex items-center justify-end">
                    <button
                      onClick={() => handleSendRequest(doc.doctorId)}
                      disabled={isActive || isPending || sendingRequest === doc.doctorId}
                      className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[#E1F5EE] border border-[#9FE1CB] text-[#085041] cursor-default'
                          : isPending
                          ? 'bg-[#FAEEDA] border border-[#FAC775] text-[#633806] cursor-default'
                          : 'bg-mist-50 border border-mist-100 text-mist-600 hover:bg-mist-100 hover:text-mist-850 hover:border-mist-200'
                      }`}
                    >
                      {sendingRequest === doc.doctorId ? (
                        <IconLoader2 size={14} stroke={1.5} className="ti-spin" />
                      ) : isActive ? (
                        <IconCheck size={14} stroke={1.5} />
                      ) : isPending ? (
                        <IconLink size={14} stroke={1.5} />
                      ) : (
                        <IconSend size={14} stroke={1.5} />
                      )}
                      <span>{buttonText}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorSearch;
