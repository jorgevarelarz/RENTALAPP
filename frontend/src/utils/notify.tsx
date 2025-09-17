import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Note = { id: string; type: "success" | "error" | "info"; text: string };

type NotifyContextValue = {
  push: (type: Note["type"], text: string) => void;
};

const NotifyContext = createContext<NotifyContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);

  const push = useCallback((type: Note["type"], text: string) => {
    const id = Math.random().toString(36).slice(2);
    setNotes((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setNotes((prev) => prev.filter((n) => n.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          display: "grid",
          gap: 8,
          zIndex: 9999,
        }}
      >
        {notes.map((n) => (
          <div
            key={n.id}
            style={{
              padding: "10px 14px",
              borderRadius: 6,
              background: n.type === "success" ? "#daf5d7" : n.type === "error" ? "#fdd" : "#eef",
              border: "1px solid rgba(0,0,0,0.1)",
              minWidth: 200,
            }}
          >
            {n.text}
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

export const useNotify = () => {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    throw new Error("useNotify must be used within NotificationsProvider");
  }
  return ctx;
};
