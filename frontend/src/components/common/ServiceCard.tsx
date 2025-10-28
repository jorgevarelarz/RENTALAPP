import React from 'react';

interface ServiceCardProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onClick?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ title, description, ctaLabel = 'Ver detalles', onClick }) => (
  <article style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, background: '#fff' }}>
    <h3 style={{ margin: '0 0 6px' }}>{title}</h3>
    <p style={{ margin: '0 0 12px', color: '#475569' }}>{description}</p>
    <button type="button" onClick={onClick} style={{
      padding: '8px 12px',
      borderRadius: 10,
      border: '1px solid #111827',
      background: '#111827',
      color: '#fff',
      cursor: 'pointer',
    }}>
      {ctaLabel}
    </button>
  </article>
);

export default ServiceCard;
