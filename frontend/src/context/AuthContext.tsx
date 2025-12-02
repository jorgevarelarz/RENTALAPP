import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
  bootstrapAuthHeader,
} from "../services/auth";

type AuthCtx = {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: User["role"][]) => boolean;
  updateUser: (changes: Partial<User>) => void;
};

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());

  const persist = (u: User | null) => {
    setUser(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem("user", JSON.stringify(u));
      else localStorage.removeItem("user");
    }
  };

  useEffect(() => {
    bootstrapAuthHeader();
  }, []);

  const login = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    persist(u);
  };

  const logout = () => {
    apiLogout();
    persist(null);
  };

  const updateUser = (changes: Partial<User>) => {
    if (!user) return;
    const next = { ...user, ...changes };
    persist(next);
  };

  const hasRole = (...roles: User["role"][]) => !!user && roles.includes(user.role);

  const token = user?.token ?? null;

  return <Ctx.Provider value={{ token, user, login, logout, hasRole, updateUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
