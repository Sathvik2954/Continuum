import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/authContext';
import { initSyncEngine } from './lib/syncEngine';
import { ProtectedRoute } from './components/ui/ProtectedRoute';
import { Navbar } from './components/ui/Navbar';
import { SyncErrorPanel } from './components/sync/SyncErrorPanel';

// Auth
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Patient
import { OnboardingPage } from './pages/patient/OnboardingPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { DoctorSearchPage } from './pages/patient/DoctorSearchPage';
import { MyDoctorsPage } from './pages/patient/MyDoctorsPage';
import { NewConsultationPage } from './pages/patient/NewConsultationPage';
import { ConsultationListPage } from './pages/patient/ConsultationListPage';
import { TimelinePage } from './pages/patient/TimelinePage';
import { ProfilePage } from './pages/patient/ProfilePage';

// Doctor
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { ConsultationDetailPage } from './pages/doctor/ConsultationDetailPage';
import { DoctorAnalyticsPage } from './pages/doctor/AnalyticsPage';
import { MyPatientsSearchPage } from './pages/doctor/MyPatientsSearchPage';

// Call
import { ScheduleCallPage } from './pages/call/ScheduleCall';
import { CallRoomPage } from './pages/call/CallRoom';

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard';

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const cleanup = initSyncEngine();
    return cleanup;
  }, []);

  return (
    <>
      {user && <Navbar />}
      <SyncErrorPanel />
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Patient onboarding */}
        <Route path="/onboarding" element={
          <ProtectedRoute role="PATIENT"><OnboardingPage /></ProtectedRoute>
        } />

        {/* Dashboard - role aware */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            {user?.role === 'DOCTOR' ? (
              <DoctorDashboard />
            ) : user?.role === 'ADMIN' ? (
              <Navigate to="/admin" replace />
            ) : (
              <PatientDashboard />
            )}
          </ProtectedRoute>
        } />

        {/* Patient-only */}
        <Route path="/doctors" element={
          <ProtectedRoute role="PATIENT"><DoctorSearchPage /></ProtectedRoute>
        } />
        <Route path="/my-doctors" element={
          <ProtectedRoute role="PATIENT"><MyDoctorsPage /></ProtectedRoute>
        } />
        <Route path="/consultations/new" element={
          <ProtectedRoute role="PATIENT"><NewConsultationPage /></ProtectedRoute>
        } />

        {/* Timeline - patient's own (no param) */}
        <Route path="/timeline" element={
          <ProtectedRoute role="PATIENT"><TimelinePage /></ProtectedRoute>
        } />
        {/* Doctor patients search */}
        <Route path="/patients" element={
          <ProtectedRoute role="DOCTOR"><MyPatientsSearchPage /></ProtectedRoute>
        } />
        {/* Timeline - doctor viewing a specific patient */}
        <Route path="/patients/:patientId/timeline" element={
          <ProtectedRoute role="DOCTOR"><TimelinePage /></ProtectedRoute>
        } />

        {/* Shared - both roles */}
        <Route path="/consultations" element={
          <ProtectedRoute><ConsultationListPage /></ProtectedRoute>
        } />
        <Route path="/consultations/:id" element={
          <ProtectedRoute><ConsultationDetailPage /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><ProfilePage /></ProtectedRoute>
        } />

        {/* Calls */}
        <Route path="/calls/schedule" element={
          <ProtectedRoute><ScheduleCallPage /></ProtectedRoute>
        } />
        <Route path="/calls/:id" element={
          <ProtectedRoute><CallRoomPage /></ProtectedRoute>
        } />

        {/* Doctor Analytics */}
        <Route path="/analytics" element={
          <ProtectedRoute role="DOCTOR"><DoctorAnalyticsPage /></ProtectedRoute>
        } />

        {/* Admin Panel */}
        <Route path="/admin" element={
          <ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
