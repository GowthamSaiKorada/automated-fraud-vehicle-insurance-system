import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('vericlaim_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vericlaim_token'));
  const [loading, setLoading] = useState<boolean>(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    apiClient
      .get('/auth/profile')
      .then((res) => {
        if (!cancelled && res.data?.user) {
          setUser(res.data.user);
          localStorage.setItem('vericlaim_user', JSON.stringify(res.data.user));
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem('vericlaim_token');
          localStorage.removeItem('vericlaim_user');
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const setSession = (newToken: string, newUser: User) => {
    localStorage.setItem('vericlaim_token', newToken);
    localStorage.setItem('vericlaim_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = (updated: User) => {
    localStorage.setItem('vericlaim_user', JSON.stringify(updated));
    setUser(updated);
  };

  const logout = () => {
    localStorage.removeItem('vericlaim_token');
    localStorage.removeItem('vericlaim_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, setSession, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
