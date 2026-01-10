import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; className?: string };

const Input: React.FC<Props> = ({ label, style, className, ...rest }) => {
  return (
    <label style={{ display: 'grid', gap: 6, width: '100%', minWidth: 0 }}>
      {label && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>}
      <input
        {...rest}
        className={className}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--fg)',
          borderRadius: 8,
          padding: '10px 12px',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          ...style,
        }}
      />
    </label>
  );
};

export default Input;
