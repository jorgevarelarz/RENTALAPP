import React, { createContext, useContext, useMemo, useState } from 'react';
import { Locale, messages } from './translations';

type I18nContextValue = {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>('es');
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: string) => messages[locale]?.[key] ?? key,
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
