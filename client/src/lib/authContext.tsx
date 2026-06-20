import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/apiClient';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  profileComplete?: boolean;
  verified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'PATIENT' | 'DOCTOR';
  // Doctor-only
  specialization?: string;
  clinicName?: string;
  city?: string;
  registrationNumber?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('continuum_token');
    const storedUser = localStorage.getItem('continuum_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data;
    persist(newToken, newUser);
  };

  const register = async (data: RegisterData) => {
    const res = await api.post('/auth/register', data);
    const { token: newToken, user: newUser } = res.data;
    persist(newToken, newUser);
  };

  const logout = () => {
    localStorage.removeItem('continuum_token');
    localStorage.removeItem('continuum_user');
    setToken(null);
    setUser(null);
  };

  const persist = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('continuum_token', newToken);
    localStorage.setItem('continuum_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
