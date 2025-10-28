import React, { createContext, useContext, useMemo, useState } from 'react';
import { FeatureFlags, initialFlags } from './flags';

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(initialFlags);

  const value = useMemo<FeatureFlagsContextValue>(() => ({
    flags,
    setFlag: (key, value) => setFlags(prev => ({ ...prev, [key]: value })),
  }), [flags]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export default FeatureFlagsProvider;

export const useFeatureFlags = () => {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return ctx;
};
