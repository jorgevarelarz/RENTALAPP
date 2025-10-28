import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { toast } from 'react-hot-toast';

export type ToastPayload = { title: string; tone?: 'info' | 'success' | 'error' };

type ToastContextValue = {
  toasts: never[];
  push: (payload: ToastPayload) => void;
  remove: (id?: string | number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const push = useCallback(({ title, tone = 'info' }: ToastPayload) => {
    if (!title) return;
    if (tone === 'success') {
      toast.success(title);
    } else if (tone === 'error') {
      toast.error(title);
    } else {
      toast(title);
    }
  }, []);

  const remove = useCallback((id?: string | number) => {
    if (id === undefined) {
      toast.dismiss();
    } else {
      toast.dismiss(id as string);
    }
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toasts: [], push, remove }), [push, remove]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
