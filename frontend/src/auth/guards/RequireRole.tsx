import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { UserRole } from '../../app/store/authSlice';

const roleHome: Record<UserRole, string> = {
  TENANT: '/tenant/home',
  LANDLORD: '/landlord/home',
  PROFESSIONAL: '/professional/home',
  AGENCY: '/agency/home',
  ADMIN: '/admin/dashboard',
};

const RequireRole: React.FC<{ roles: UserRole[]; children: React.ReactElement }> = ({ roles, children }) => {
  const user = useAppSelector(state => state.auth.user);

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.activeRole)) {
    return <Navigate to={roleHome[user.activeRole]} replace state={{ code: 403 }} />;
  }

  return children;
};

export default RequireRole;
