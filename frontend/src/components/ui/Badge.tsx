import React from 'react';
import type { StatusTone } from '../../utils/statusBadges';

// Pastilla de estado. Los colores salen de .ra-badge-<tono> (index.css), no de estilos en línea.
const Badge: React.FC<{
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}> = ({ children, tone = 'neutral', className }) => (
  <span className={['ra-badge', `ra-badge-${tone}`, className].filter(Boolean).join(' ')}>{children}</span>
);

export default Badge;
