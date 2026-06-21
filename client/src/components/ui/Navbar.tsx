import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { LanguageSwitcher } from './LanguageSwitcher';

const NAV_PATIENT = [
  { to: '/dashboard',      label: 'Dashboard' },
  { to: '/timeline',       label: 'Timeline' },
  { to: '/consultations',  label: 'Consultations' },
  { to: '/doctors',        label: 'Find Doctors' },
  { to: '/my-doctors',     label: 'My Doctors' },
  { to: '/calls/schedule', label: 'Schedule Call' },
];

const NAV_DOCTOR = [
  { to: '/dashboard',      label: 'Dashboard' },
  { to: '/patients',       label: 'My Patients' },
  { to: '/consultations',  label: 'Consultations' },
  { to: '/calls/schedule', label: 'Schedule Call' },
  { to: '/analytics',      label: 'Analytics' },
];

const NAV_ADMIN = [
  { to: '/admin',         label: 'Admin Panel' },
];

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = user?.role === 'ADMIN'
    ? NAV_ADMIN
    : user?.role === 'DOCTOR'
    ? NAV_DOCTOR
    : NAV_PATIENT;

  const initials = user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <nav className="glass-navbar sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <div className="flex flex-col leading-none select-none mr-2">
          <span className="text-[15px] font-medium text-sky-900 tracking-widest">CONTINUUM</span>
          <span className="text-[10px] text-[#78716C]">healthcare continuity</span>
        </div>

        <div className="flex items-center gap-1 flex-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to}
              className={({ isActive }) =>
                `px-3 py-1.5 text-[13px] rounded-sm transition-colors duration-150 ${
                  isActive ? 'text-sky-600 border-b-2 border-sky-400' : 'text-[#78716C] hover:text-sky-600'
                }`
              }>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={() => { logout(); navigate('/login'); }}
            title="Logout"
            className="w-9 h-9 rounded-full glass-subtle flex items-center justify-center text-[13px] font-medium text-sky-900 hover:glass transition-all">
            {initials}
          </button>
        </div>
      </div>
    </nav>
  );
};
