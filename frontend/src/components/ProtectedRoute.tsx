import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactElement;
};

export default function ProtectedRoute({ children }: Props) {
  const { user } = useAuth();
  const location = useLocation();

  // Con la consulta y el ancla: un enlace de un correo («/contracts/…?deposit=success») vuelve entero tras entrar
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;

  return children;
}
