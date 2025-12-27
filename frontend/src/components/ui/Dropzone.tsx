import React, { useCallback, useRef, useState } from 'react';

type Props = {
  onFiles: (files: File[]) => void;
  label?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const Dropzone: React.FC<Props> = ({ onFiles, label = 'Arrastra y suelta imágenes o haz clic', className, style }) => {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  }, [onFiles]);

  const onChoose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      aria-label="Subir imágenes"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      className={className}
      style={{
        padding: 16,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'center',
        color: 'var(--muted)',
        ...style,
        background: over ? 'rgba(79,70,229,0.08)' : style?.background,
      }}
    >
      <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={onChoose} />
      {label}
    </div>
  );
};

export default Dropzone;
