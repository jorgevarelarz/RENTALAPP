import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string };

const Input: React.FC<Props> = ({ label, style, ...rest }) => {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      {label && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>}
      <input
        {...rest}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--fg)',
          borderRadius: 8,
          padding: '10px 12px',
          ...style,
        }}
      />
    </label>
  );
};

export default Input;

