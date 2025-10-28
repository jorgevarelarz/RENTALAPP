import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type Props = {
  children: React.ReactElement;
};

export default function ProtectedRoute({ children }: Props) {
  const { user, legalStatus, legalStatusLoading } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const hasPendingLegal = (() => {
    if (!legalStatus) return false;
    const termsOk = !legalStatus.terms.latest || legalStatus.terms.acceptedVersion === legalStatus.terms.latest.version;
    const privacyOk =
      !legalStatus.privacy.latest || legalStatus.privacy.acceptedVersion === legalStatus.privacy.latest.version;
    return !(termsOk && privacyOk);
  })();

  if (!legalStatus && legalStatusLoading) {
    return <div style={{ padding: 24 }}>Comprobando documentación legal…</div>;
  }

  if (hasPendingLegal && location.pathname !== "/legal-consent") {
    return <Navigate to="/legal-consent" replace state={{ from: location.pathname }} />;
  }

  if (!hasPendingLegal && location.pathname === "/legal-consent") {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  return children;
}
