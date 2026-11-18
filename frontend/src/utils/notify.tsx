import { useToast } from "../context/ToastContext";

type NoteType = "success" | "error" | "info";

/** Compatibilidad: `push(tipo, texto)` sobre el ToastProvider montado en index.tsx. */
export const useNotify = () => {
  const toast = useToast();
  return {
    push: (type: NoteType, text: string) => toast.push({ title: text, tone: type }),
  };
};
