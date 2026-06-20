import React from 'react';
import { Navigate } from 'react-router-dom';
// In src/components/ui/Navbar.tsx — make sure it reads
import { useAuth } from '../../lib/authContext';

interface Props {
  children: React.ReactNode;
  role?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}

export const ProtectedRoute: React.FC<Props> = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-xl px-8 py-6 text-[14px] text-sky-900">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
