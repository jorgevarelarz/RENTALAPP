import React from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

const Select: React.FC<Props> = ({ label, children, style, ...rest }) => (
  <label style={{ display: 'grid', gap: 6 }}>
    {label && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>}
    <select
      {...rest}
      style={{
        border: '1px solid var(--border)',
        background: 'var(--card)',
        color: 'var(--fg)',
        borderRadius: 8,
        padding: '10px 12px',
        ...style,
      }}
    >
      {children}
    </select>
  </label>
);

export default Select;

