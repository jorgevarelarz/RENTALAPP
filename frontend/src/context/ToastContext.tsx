import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type Toast = { id: number; title: string; tone?: 'info' | 'success' | 'error' };

const ToastContext = createContext<{
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  remove: (id: number) => void;
} | undefined>(undefined);

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle };
// Los errores se leen con más calma
const DURATION = { info: 3500, success: 3500, error: 6000 };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Contador y no Date.now(): dos avisos en el mismo milisegundo compartían id y se cerraban juntos
  const nextId = useRef(0);
  const remove = useCallback((id: number) => setToasts(arr => arr.filter(x => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++nextId.current;
    setToasts(arr => [...arr, { id, ...t }]);
    setTimeout(() => remove(id), DURATION[t.tone || 'info']);
  }, [remove]);
  const value = useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ra-toasts" aria-live="polite">
        {toasts.map(t => {
          const tone = t.tone || 'info';
          const Icon = ICONS[tone];
          return (
            <div key={t.id} className={`ra-toast ra-toast-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
              <Icon size={18} aria-hidden className="ra-toast-icon" />
              <span className="ra-toast-text">{t.title}</span>
              <button type="button" className="ra-toast-close" onClick={() => remove(t.id)} aria-label="Cerrar aviso">
                <X size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
