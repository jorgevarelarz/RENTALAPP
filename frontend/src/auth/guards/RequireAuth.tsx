import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = useAppSelector(state => state.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default RequireAuth;
