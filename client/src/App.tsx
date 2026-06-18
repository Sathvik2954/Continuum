import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { IconWifi, IconWifiOff, IconRefresh, IconLogout, IconAlertCircle } from '@tabler/icons-react';
import syncEngine from './lib/syncEngine';
import Logo from './components/Logo';

// Page imports
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import PatientDashboard from './pages/patient/Dashboard';
import PatientTimeline from './pages/patient/Timeline';
import PatientProfile from './pages/patient/Profile';
import NewConsultation from './pages/patient/NewConsultation';
import DoctorSearch from './pages/patient/DoctorSearch';
import VitalsLogger from './pages/patient/VitalsLogger';
import DocumentUpload from './pages/patient/DocumentUpload';
import DoctorDashboard from './pages/doctor/Dashboard';
import PatientView from './pages/doctor/PatientView';
import ConsultationResponse from './pages/doctor/ConsultationResponse';
import DoctorAnalytics from './pages/doctor/Analytics';
import CallRoom from './pages/call/CallRoom';
import AdminDashboard from './pages/admin/Dashboard';

interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  name: string;
  profileCompleted?: boolean;
}

const NavigationTabs = ({ userRole }: { userRole: 'PATIENT' | 'DOCTOR' | 'ADMIN' }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = {
    PATIENT: [
      { path: '/patient/dashboard', label: 'Dashboard' },
      { path: '/patient/timeline', label: 'Health Timeline' },
      { path: '/patient/doctors', label: 'Doctor Network' },
      { path: '/patient/profile', label: 'My Profile' },
    ],
    DOCTOR: [
      { path: '/doctor/dashboard', label: 'Dashboard' },
      { path: '/doctor/analytics', label: 'Practice Analytics' },
    ],
    ADMIN: [
      { path: '/admin/dashboard', label: 'Admin Dashboard' },
    ],
  };

  const currentTabs = tabs[userRole] || [];

  return (
    <div className="bg-white border-b border-mist-100 h-11 flex items-center px-4 md:px-8 gap-2">
      {currentTabs.map((tab) => {
        const isActive = currentPath === tab.path || (tab.path !== '/' && currentPath.startsWith(tab.path));
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-4 py-2 text-[13px] font-medium transition-all ${
              isActive
                ? 'bg-mist-50 text-mist-600 rounded-lg'
                : 'text-neutral-500 hover:text-mist-600'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};

const MainLayout = ({
  user,
  isOnline,
  syncStatus,
  handleLogout,
  children,
}: {
  user: User | null;
  isOnline: boolean;
  syncStatus: any;
  handleLogout: () => void;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-mist-50 text-mist-900">
      {/* Navigation Bar */}
      <header className="bg-mist-400 h-12 px-4 md:px-8 flex items-center justify-between text-white select-none">
        <div className="flex items-center space-x-2">
          {/* Logo SVG beside wordmark */}
          <Logo color="#FFFFFF" width={26} />
          <span className="font-medium text-[15px] tracking-wide">
            CONTINUUM
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Online/Offline Action Icon */}
          <div
            title={isOnline ? 'Online' : 'Offline'}
            className="w-8 h-8 rounded-lg bg-white/18 flex items-center justify-center text-white"
          >
            {isOnline ? (
              <IconWifi size={18} stroke={1.5} />
            ) : (
              <IconWifiOff size={18} stroke={1.5} />
            )}
          </div>

          {/* Sync Trigger Icon */}
          {user && (
            <button
              onClick={() => syncEngine.triggerSync()}
              disabled={syncStatus.syncing || !isOnline}
              title={syncStatus.syncing ? 'Syncing...' : 'Force Sync'}
              className="w-8 h-8 rounded-lg bg-white/18 flex items-center justify-center text-white hover:bg-white/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <IconRefresh size={18} className={syncStatus.syncing ? 'ti-spin' : ''} stroke={1.5} />
            </button>
          )}

          {/* Profile Initials & Logout */}
          {user && (
            <div className="flex items-center space-x-2.5 pl-2 border-l border-white/20 h-6">
              <div
                className="w-7 h-7 rounded-full bg-mist-100 text-mist-800 text-[11px] font-medium flex items-center justify-center cursor-default uppercase"
                title={`${user.name} (${user.role})`}
              >
                {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="w-8 h-8 rounded-lg bg-white/18 flex items-center justify-center text-white hover:bg-white/25 transition-all cursor-pointer"
              >
                <IconLogout size={16} stroke={1.5} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs Row */}
      {user && <NavigationTabs userRole={user.role} />}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8">
        {children}
      </main>

      {/* Sync Status Widget at Bottom */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-2 flex items-center justify-center select-none bg-mist-50 border-t border-mist-100">
          {syncStatus.hasErrors ? (
            <div
              onClick={() => syncEngine.triggerSync()}
              className="bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 cursor-pointer transition-all hover:bg-[#fae2e2]"
            >
              <span className="w-2 h-2 rounded-full bg-urgent animate-pulse" />
              <span>Sync failed — tap to retry</span>
            </div>
          ) : syncStatus.pendingCount > 0 ? (
            <div className="bg-[#FAEEDA] text-[#633806] border border-[#FAC775] px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-high" />
              <span>{syncStatus.pendingCount} items pending sync</span>
            </div>
          ) : (
            <div className="bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>Synced {syncStatus.lastSyncedAt ? `at ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'successfully'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState({
    pendingCount: 0,
    syncing: false,
    hasErrors: false,
    lastSyncedAt: undefined as number | undefined,
  });
  const [conflictAlert, setConflictAlert] = useState<{ type: string; visible: boolean } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Read session from local storage on load
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }

    // Monitor network online/offline state
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync queue status updates
    const unsubscribeSync = syncEngine.subscribe((status) => {
      setSyncStatus({
        pendingCount: status.pendingCount,
        syncing: status.syncing,
        hasErrors: status.hasErrors,
        lastSyncedAt: status.lastSyncedAt,
      });
    });

    // Listen for conflict alerts from the sync engine
    const handleConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setConflictAlert({ type: detail.type, visible: true });
    };
    window.addEventListener('continuum-sync-conflict', handleConflict);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('continuum-sync-conflict', handleConflict);
      unsubscribeSync();
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  // Auth Guard Components
  const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
    if (!token || !user) {
      return <Navigate to="/login" replace />;
    }
    if (roles && !roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      <MainLayout
        user={user}
        isOnline={isOnline}
        syncStatus={syncStatus}
        handleLogout={handleLogout}
      >
        {/* Sync Version Conflict Toast Alert */}
        {conflictAlert?.visible && (
          <div className="fixed bottom-14 right-6 z-50 max-w-sm bg-[#FCEBEB] text-[#791F1F] border border-[#F09595] rounded-xl p-4 shadow-lg flex items-start space-x-3.5 animate-slide-up">
            <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-600">
              <IconAlertCircle size={20} stroke={1.5} />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-[13px]">Version Conflict</h4>
              <p className="text-[12px] opacity-90 mt-1">
                Your local updates to <strong>{conflictAlert.type}</strong> were auto-merged with the newer server copy.
              </p>
              <button
                onClick={() => setConflictAlert(null)}
                className="mt-2.5 px-3 py-1 bg-[#FCEBEB] hover:bg-[#f7d7d7] border border-[#F09595] text-xs font-medium rounded-md transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        )}

        <Routes>
          {/* Default Page Routing Redirects */}
          <Route path="/" element={<Home />} />

          {/* Public Auth Routes */}
          <Route path="/login" element={<Login setUser={setUser} setToken={setToken} />} />
          <Route path="/register" element={<Register setUser={setUser} setToken={setToken} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Patient Protected Routes */}
          <Route
            path="/patient/dashboard"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/timeline"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <PatientTimeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <PatientProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/new-consultation"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <NewConsultation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/doctors"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <DoctorSearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/vitals/new"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <VitalsLogger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/documents/new"
            element={
              <ProtectedRoute roles={['PATIENT']}>
                <DocumentUpload />
              </ProtectedRoute>
            }
          />

          {/* Doctor Protected Routes */}
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute roles={['DOCTOR']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients/:id"
            element={
              <ProtectedRoute roles={['DOCTOR']}>
                <PatientView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/consultations/:id"
            element={
              <ProtectedRoute roles={['DOCTOR']}>
                <ConsultationResponse />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/analytics"
            element={
              <ProtectedRoute roles={['DOCTOR']}>
                <DoctorAnalytics />
              </ProtectedRoute>
            }
          />

          {/* Live WebRTC Call Route */}
          <Route
            path="/call/room/:id"
            element={
              <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
                <CallRoom />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
