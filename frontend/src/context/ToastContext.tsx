import React, { createContext, useContext, useMemo, useState } from 'react';

export type Toast = { id: number; title: string; tone?: 'info' | 'success' | 'error' };

const ToastContext = createContext<{
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  remove: (id: number) => void;
} | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now();
    setToasts(arr => [...arr, { id, ...t }]);
    setTimeout(() => setToasts(arr => arr.filter(x => x.id !== id)), 3500);
  };
  const remove = (id: number) => setToasts(arr => arr.filter(x => x.id !== id));
  const value = useMemo(() => ({ toasts, push, remove }), [toasts]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.tone === 'error' ? '#ef4444' : t.tone === 'success' ? '#22c55e' : 'var(--card)',
            color: t.tone ? 'white' : 'var(--fg)',
            border: '1px solid var(--border)',
            padding: '10px 12px',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)'
          }}>
            {t.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

