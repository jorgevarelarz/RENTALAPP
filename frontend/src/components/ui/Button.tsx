import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md';
};

const Button: React.FC<Props> = ({ variant = 'primary', size = 'md', children, ...rest }) => {
  const base: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: size === 'sm' ? '6px 10px' : '10px 14px',
    cursor: 'pointer',
    fontWeight: 600,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--primary)', color: 'white', borderColor: 'transparent' },
    secondary: { background: 'var(--card)', color: 'var(--fg)' },
    ghost: { background: 'transparent', color: 'var(--fg)' },
    danger: { background: '#ef4444', color: 'white', borderColor: 'transparent' },
    outline: { background: 'transparent', color: 'var(--fg)' },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} {...rest}>
      {children}
    </button>
  );
};

export default Button;
