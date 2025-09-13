import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const value = useMemo(() => ({ theme, toggle: () => setTheme(t => (t === 'light' ? 'dark' : 'light')) }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

