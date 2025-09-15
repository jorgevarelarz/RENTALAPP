import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

const PublicOnlyRoute: React.FC = () => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <div className="route-guard-loading">Cargando sesión…</div>;
  }

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
