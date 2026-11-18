import React from 'react';
import { useToast } from '../context/ToastContext';

export default function CopyLinkButton({ label = 'Copiar enlace' }: { label?: string }) {
  const { push } = useToast();
  const onCopy = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      push({ title: 'Enlace copiado', tone: 'success' });
    } catch (e) {
      push({ title: 'No se pudo copiar el enlace', tone: 'error' });
    }
  };
  return (
    <button onClick={onCopy} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50" type="button">
      {label}
    </button>
  );
}

