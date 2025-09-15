import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
