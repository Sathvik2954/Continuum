import React from 'react';
import { useAuth } from '../../lib/authContext';
import { GlassCard } from '../../components/ui/GlassCard';
 
export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
 
  const initials = user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
 
  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-24">
      <div className="mb-7">
        <h1 className="text-[22px] font-medium text-sky-900">Profile</h1>
        <p className="text-[13px] text-[#78716C] mt-1">Your account information</p>
      </div>
 
      <GlassCard className="p-6 flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center text-[20px] font-medium text-sky-900">
          {initials}
        </div>
        <div>
          <div className="text-[17px] font-medium text-sky-900">
            {user?.role === 'DOCTOR' ? 'Dr. ' : ''}{user?.name}
          </div>
          <div className="text-[13px] text-[#78716C]">{user?.email}</div>
          <div className="text-[12px] text-sky-600 mt-1 capitalize">{user?.role?.toLowerCase()}</div>
        </div>
      </GlassCard>
 
      <GlassCard className="p-6">
        <p className="text-[13px] text-[#78716C]">
          {user?.role === 'PATIENT'
            ? 'To update your health profile (blood group, allergies, emergency contact), visit your dashboard.'
            : 'To update your practice details, contact support.'}
        </p>
      </GlassCard>
    </div>
  );
};
