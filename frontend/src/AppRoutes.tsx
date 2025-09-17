import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/auth/LoginPage";
import ForbiddenPage from "./pages/system/ForbiddenPage";
import PropertiesList from "./pages/properties/PropertiesList";
import PropertyDetail from "./pages/properties/PropertyDetail";
import FavoritesPage from "./pages/properties/FavoritesPage";
import ContractWizard from "./pages/contracts/ContractWizard";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import TicketsList from "./pages/tickets/TicketsList";
import TicketCreatePage from "./pages/tickets/TicketCreatePage";
import TicketDetail from "./pages/tickets/TicketDetail";

export default function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<PropertiesList />} />
            <Route path="/properties" element={<PropertiesList />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route
              path="/contracts"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["tenant", "landlord", "admin"]}>
                    <div>Listado de contratos</div>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/favorites"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["tenant", "landlord", "admin"]}>
                    <FavoritesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/contracts/new"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["landlord", "admin"]}>
                    <ContractWizard />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <TicketsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets/new"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["tenant", "landlord", "admin"]}>
                    <TicketCreatePage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <ProtectedRoute>
                  <TicketDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/owner/properties"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["landlord", "admin"]}>
                    <div>Panel propietario</div>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pro/tickets"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["pro", "admin"]}>
                    <div>Panel profesional</div>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["admin"]}>
                    <div>Panel admin</div>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
