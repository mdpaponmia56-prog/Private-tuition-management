import React, { createContext, useContext, useState, useEffect } from 'react';
import { Admin } from '../types/index.js';

interface AuthContextType {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tuition_token') || ''}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setAdmin(data.admin);
      } else {
        setAdmin(null);
        localStorage.removeItem('tuition_token');
      }
    } catch {
      setAdmin(null);
      localStorage.removeItem('tuition_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed.' };
      }

      if (data.token) {
        localStorage.setItem('tuition_token', data.token);
      }
      setAdmin(data.admin);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to backend.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('tuition_token') || ''}`,
        },
      });
    } finally {
      localStorage.removeItem('tuition_token');
      setAdmin(null);
    }
  };

  const value = {
    admin,
    isAuthenticated: !!admin,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
