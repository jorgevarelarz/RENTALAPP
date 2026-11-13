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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // Espacio haría scroll de la página
          inputRef.current?.click();
        }
      }}
      data-over={over || undefined}
      className={[
        'cursor-pointer rounded-xl p-4 text-center text-[var(--ra-muted)] outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)] focus-visible:ring-offset-2',
        'data-[over=true]:border-[var(--ra-blue)] data-[over=true]:bg-[rgba(67,104,255,.08)]',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={onChoose} />
      {label}
    </div>
  );
};

export default Dropzone;
