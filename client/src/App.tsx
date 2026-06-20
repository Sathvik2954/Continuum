import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/authContext';
import { initSyncEngine } from './lib/syncEngine';
import { ProtectedRoute } from './components/ui/ProtectedRoute';
import { Navbar } from './components/ui/Navbar';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { OnboardingPage } from './pages/patient/OnboardingPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorSearchPage } from './pages/patient/DoctorSearchPage';
import { MyDoctorsPage } from './pages/patient/MyDoctorsPage';
import { ConsultationListPage } from './pages/patient/ConsultationListPage';
import { NewConsultationPage } from './pages/patient/NewConsultationPage';
import { ConsultationDetailPage } from './pages/doctor/ConsultationDetailPage';

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const cleanup = initSyncEngine();
    return cleanup;
  }, []);

  return (
    <>
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Patient onboarding */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute role="PATIENT">
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Dashboards — role-based */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              {user?.role === 'DOCTOR'
                ? <DoctorDashboard />
                : <PatientDashboard />
              }
            </ProtectedRoute>
          }
        />

        {/* Doctor Search */}
        <Route
          path="/doctors"
          element={
            <ProtectedRoute role="PATIENT">
              <DoctorSearchPage />
            </ProtectedRoute>
          }
        />

        {/* Patient's connected doctors */}
        <Route
          path="/my-doctors"
          element={
            <ProtectedRoute role="PATIENT">
              <MyDoctorsPage />
            </ProtectedRoute>
          }
        />

        {/* Consultations list */}
        <Route
          path="/consultations"
          element={
            <ProtectedRoute>
              <ConsultationListPage />
            </ProtectedRoute>
          }
        />

        {/* Create new consultation */}
        <Route
          path="/consultations/new"
          element={
            <ProtectedRoute role="PATIENT">
              <NewConsultationPage />
            </ProtectedRoute>
          }
        />

        {/* Consultation detail & response */}
        <Route
          path="/consultations/:id"
          element={
            <ProtectedRoute>
              <ConsultationDetailPage />
            </ProtectedRoute>
          }
        />

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
