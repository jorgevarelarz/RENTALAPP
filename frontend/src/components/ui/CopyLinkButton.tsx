import React from 'react';

export default function CopyLinkButton({ label = 'Copiar enlace' }: { label?: string }) {
  const onCopy = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      try { require('react-hot-toast').toast.success('Enlace copiado'); } catch {}
    } catch (e) {
      try { require('react-hot-toast').toast.error('No se pudo copiar'); } catch {}
    }
  };
  return (
    <button onClick={onCopy} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50" type="button">
      {label}
    </button>
  );
}

