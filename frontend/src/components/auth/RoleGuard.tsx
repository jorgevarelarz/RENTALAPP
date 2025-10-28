import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type Props = {
  roles: Array<"tenant" | "landlord" | "pro" | "admin">;
  children: React.ReactElement;
};

export default function RoleGuard({ roles, children }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    const home: Record<string, string> = {
      tenant: '/tenant',
      landlord: '/landlord',
      pro: '/pro',
      admin: '/admin',
    };
    return <Navigate to={home[user.role] || '/'} replace />;
  }

  return children;
}
