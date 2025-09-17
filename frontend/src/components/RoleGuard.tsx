import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  roles: Array<"tenant" | "landlord" | "pro" | "admin">;
  children: JSX.Element;
};

export default function RoleGuard({ roles, children }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;

  return children;
}
