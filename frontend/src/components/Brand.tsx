import { Link } from 'react-router-dom';

type BrandProps = {
  to?: string;
  compact?: boolean;
  inverse?: boolean;
  className?: string;
};

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`ra-brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 44 44" role="img">
        <path d="M10.5 22.3 22 11.8l11.5 10.5v12.1a2.6 2.6 0 0 1-2.6 2.6H13.1a2.6 2.6 0 0 1-2.6-2.6V22.3Z" />
        <path d="M18.4 37V25.9h7.2V37" />
      </svg>
    </span>
  );
}

export default function Brand({ to = '/', compact = false, inverse = false, className = '' }: BrandProps) {
  return (
    <Link
      to={to}
      className={`ra-brand ${inverse ? 'ra-brand-inverse' : ''} ${className}`}
      aria-label="RentalApp, inicio"
    >
      <BrandMark />
      {!compact && (
        <span className="ra-brand-word">
          Rental<span>App</span>
        </span>
      )}
    </Link>
  );
}
