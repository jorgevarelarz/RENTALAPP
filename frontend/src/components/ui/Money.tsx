import React from 'react';

interface MoneyProps {
  value: number;
  currency?: string;
}

const Money: React.FC<MoneyProps> = ({ value, currency = 'EUR' }) => {
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value);
  return <span>{formatted}</span>;
};

export default Money;
