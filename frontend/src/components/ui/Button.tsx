import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/**
 * Clases del botón (sistema 2026, `.ra-btn*` en index.css). Sirve también para dar
 * aspecto de botón a un `<Link>` sin meter un `<button>` dentro de un enlace.
 * `outline` es un alias de `secondary`.
 */
export function buttonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  const tone = variant === 'outline' ? 'secondary' : variant;
  return ['ra-btn', `ra-btn-${tone}`, size !== 'md' ? `ra-btn-${size}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

const Button: React.FC<Props> = ({ variant = 'primary', size = 'md', type = 'button', children, className, ...rest }) => (
  <button type={type} className={buttonClassName(variant, size, className)} {...rest}>
    {children}
  </button>
);

export default Button;
