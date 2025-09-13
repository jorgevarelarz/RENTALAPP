import React from 'react';
import { useLocation } from 'react-router-dom';
import Placeholder from './Placeholder';

const labels: Record<string, string> = {
  dashboard: 'Inicio',
  contracts: 'Contratos',
  payments: 'Pagos',
  issues: 'Incidencias',
  profile: 'Perfil',
  support: 'Soporte',
  properties: 'Propiedades',
  jobs: 'Trabajos',
  verification: 'Verificación',
  reports: 'Reportes y auditoría',
};

const AutoPlaceholder: React.FC = () => {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const key = parts[parts.length - 1] || '';
  const title = labels[key] || key || 'Sección';
  return <Placeholder title={title} />;
};

export default AutoPlaceholder;

