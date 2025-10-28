import React, { createContext, useCallback, useContext, useMemo } from "react";
import { toast } from "react-hot-toast";

type NotifyContextValue = {
  push: (type: "success" | "error" | "info", text: string) => void;
};

const NotifyContext = createContext<NotifyContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const push = useCallback<NotifyContextValue["push"]>((type, text) => {
    if (!text) return;
    if (type === "success") {
      toast.success(text);
    } else if (type === "error") {
      toast.error(text);
    } else {
      toast(text);
    }
  }, []);

  const value = useMemo<NotifyContextValue>(() => ({ push }), [push]);

  return <NotifyContext.Provider value={value}>{children}</NotifyContext.Provider>;
}

export const useNotify = () => {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    throw new Error("useNotify must be used within NotificationsProvider");
  }
  return ctx;
};
