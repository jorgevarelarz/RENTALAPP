import React, { useEffect, useRef, useCallback } from 'react';

interface Props {
  signingUrl: string;
  onSigned: () => void;
  onCancel: () => void;
  onError: (error: any) => void;
}

export default function SignaturitWidget({ signingUrl, onSigned, onCancel, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const initWidget = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    try {
      // @ts-ignore
      const client = new window.SignaturitClient(containerRef.current);
      client.render(signingUrl);
      client.on('completed', () => onSigned());
      client.on('declined', () => onCancel());
    } catch (err) {
      console.error('Error iniciando Signaturit', err);
      onError(err);
    }
  }, [onSigned, onCancel, onError, signingUrl]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://loader.sandbox.signaturit.com/lib/3/signaturit.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.SignaturitClient) {
        initWidget();
      }
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [initWidget]);

  return (
    <div className="w-full h-full min-h-[600px] bg-gray-50 rounded-lg overflow-hidden border border-gray-200 relative">
      <div id="signaturit-container" ref={containerRef} className="w-full h-full" />
      <div className="absolute inset-0 -z-10 flex items-center justify-center text-gray-400">
        Cargando entorno de firma segura...
      </div>
    </div>
  );
}
