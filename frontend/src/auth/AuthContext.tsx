import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { decodeJwt } from '../utils/jwt';

type Role = 'tenant' | 'landlord' | 'admin' | 'pro';

export type AuthUser = {
  id: string;
  role: Role;
  email?: string;
  name?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, userOverride?: Partial<AuthUser>) => void;
  logout: () => void;
  isLoading: boolean;
};

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isRole = (value: unknown): value is Role =>
  value === 'tenant' || value === 'landlord' || value === 'admin' || value === 'pro';

const fromToken = (token: string): AuthUser | null => {
  const payload = decodeJwt(token);
  if (!payload) return null;
  const { id, role, email, name } = payload;
  if (!id) return null;
  if (!isRole(role)) return null;
  return {
    id: String(id),
    role,
    email: typeof email === 'string' ? email : undefined,
    name: typeof name === 'string' ? name : undefined,
  };
};

const parseStoredUser = (raw: string | null): AuthUser | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.id || !parsed.role || !isRole(parsed.role)) return null;
    return {
      id: String(parsed.id),
      role: parsed.role,
      email: parsed.email,
      name: parsed.name,
    };
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = parseStoredUser(localStorage.getItem(USER_KEY));
    if (storedToken) {
      setToken(storedToken);
      setUser(storedUser ?? fromToken(storedToken));
    } else {
      setToken(null);
      setUser(null);
      if (storedUser) localStorage.removeItem(USER_KEY);
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((nextToken: string | null, nextUser: AuthUser | null) => {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const login = useCallback(
    (nextToken: string, userOverride?: Partial<AuthUser>) => {
      const decoded = fromToken(nextToken);
      const merged = decoded
        ? { ...decoded, ...userOverride }
        : userOverride && userOverride.id && userOverride.role && isRole(userOverride.role)
          ? {
            id: String(userOverride.id),
            role: userOverride.role,
            email: userOverride.email,
            name: userOverride.name,
          }
          : null;
      setToken(nextToken);
      setUser(merged);
      persist(nextToken, merged);
    },
    [persist],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    persist(null, null);
  }, [persist]);

  const value = useMemo(
    () => ({ token, user, login, logout, isLoading }),
    [token, user, login, logout, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
