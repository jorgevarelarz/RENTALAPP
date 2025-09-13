import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { decodeJwt } from '../utils/jwt';

type User = { id: string; role: 'tenant' | 'landlord' | 'admin' | 'pro' };

type AuthContextType = {
  token: string | null;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (t) applyToken(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyToken = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem('token', t);
    const p = decodeJwt(t);
    if (p && p.id && p.role) setUser({ id: String(p.id), role: p.role as any });
  }, []);

  const login = useCallback((t: string) => applyToken(t), [applyToken]);
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ token, user, login, logout }), [token, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
