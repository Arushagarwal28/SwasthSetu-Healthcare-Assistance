import { createContext, useContext, useState,type ReactNode } from 'react';
import axiosClient from '../api/axiosClient';
interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as User;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });

  const setUser = (u: User | null) => {
    setUserState(u);

    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
    }
  };

const logout = async () => {
  const refreshToken = localStorage.getItem('refreshToken');

  try {
    if (refreshToken) {
      await axiosClient.post('/auth/logout', {
        refreshToken,
      });
    }
  } catch (error) {
    console.error('LOGOUT ERROR:', error);
  } finally {
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
};