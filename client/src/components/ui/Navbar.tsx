import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/authContext';
import { LanguageSwitcher } from './LanguageSwitcher';
 
export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
 
  const NAV_PATIENT = [
    { to: '/dashboard',      label: t('nav.dashboard') },
    { to: '/timeline',       label: t('nav.timeline') },
    { to: '/consultations',  label: t('nav.consultations') },
    { to: '/doctors',        label: t('nav.findDoctors') },
    { to: '/my-doctors',     label: t('nav.myDoctors') },
    { to: '/calls/schedule', label: t('nav.scheduleCall') },
  ];
 
  const NAV_DOCTOR = [
    { to: '/dashboard',     label: t('nav.dashboard') },
    { to: '/consultations', label: t('nav.consultations') },
    { to: '/patients',      label: t('nav.myPatients') },
    { to: '/analytics',     label: t('nav.analytics') },
  ];
 
  const NAV_ADMIN = [
    { to: '/admin', label: 'Admin' },
  ];
 
  const links = user?.role === 'DOCTOR' ? NAV_DOCTOR : user?.role === 'ADMIN' ? NAV_ADMIN : NAV_PATIENT;
  const initials = user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
 
  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
 
  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };
 
  return (
    <nav className="glass-navbar sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <div className="flex flex-col leading-none select-none mr-2">
          <span className="text-[15px] font-medium text-sky-900 tracking-widest">CONTINUUM</span>
          <span className="text-[10px] text-[#78716C]">Healthcare Continuity</span>
        </div>
 
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to}
              className={({ isActive }) =>
                `px-3 py-1.5 text-[13px] rounded-sm whitespace-nowrap transition-colors duration-150 ${
                  isActive ? 'text-sky-600 border-b-2 border-sky-400' : 'text-[#78716C] hover:text-sky-600'
                }`
              }>
              {link.label}
            </NavLink>
          ))}
        </div>
 
        <LanguageSwitcher />
 
        {/* Profile dropdown - separate from logout, click avatar to open */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-9 h-9 rounded-full glass-subtle flex items-center justify-center text-[13px] font-medium text-sky-900 hover:glass transition-all"
          >
            {initials}
          </button>
 
          {menuOpen && (
            <div
              className="absolute right-0 top-11 w-44 glass-elevated rounded-lg overflow-hidden z-50"
              style={{ animation: 'fadeIn 150ms ease' }}
            >
              <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.35)]">
                <div className="text-[13px] font-medium text-sky-900 truncate">{user?.name}</div>
                <div className="text-[11px] text-[#78716C] truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="w-full text-left px-3 py-2.5 text-[13px] text-sky-900 hover:bg-[rgba(255,255,255,0.20)] transition-colors"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-[rgba(239,68,68,0.12)] transition-colors"
                style={{ color: '#991B1B' }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
