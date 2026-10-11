import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
  bootstrapAuthHeader,
  refreshStoredUser,
} from "../services/auth";

type AuthCtx = {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: User["role"][]) => boolean;
};

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());

  useEffect(() => {
    bootstrapAuthHeader();
    let cancelled = false;
    refreshStoredUser().then((fresh) => {
      if (fresh && !cancelled) setUser(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const hasRole = (...roles: User["role"][]) => !!user && roles.includes(user.role);

  const token = user?.token ?? null;

  return <Ctx.Provider value={{ token, user, login, logout, hasRole }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
