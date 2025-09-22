import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppShell from "./layout/AppShell";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import RegisterPage from "./pages/auth/RegisterPage";
import ForbiddenPage from "./pages/system/ForbiddenPage";
import PropertiesList from "./pages/properties/PropertiesList";
import PropertyDetail from "./pages/properties/PropertyDetail";
import FavoritesPage from "./pages/properties/FavoritesPage";
import ContractWizard from "./pages/contracts/ContractWizard";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import Inbox from "./pages/Inbox";
import TicketsList from "./pages/tickets/TicketsList";
import TicketCreatePage from "./pages/tickets/TicketCreatePage";
import TicketDetail from "./pages/tickets/TicketDetail";
import AdminTenantProPage from "./pages/admin/AdminTenantProPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminPropertiesPage from "./pages/admin/AdminPropertiesPage";
import AdminReports from "./pages/admin/Reports";
import AdminIncidents from "./pages/admin/Incidents";
import AdminSettings from "./pages/admin/Settings";
import AdminPayments from "./pages/admin/Payments";
import RedirectHome from "./pages/RedirectHome";
import MyContracts from "./pages/MyContracts";
import LandlordDashboard from "./pages/LandlordDashboard";
import ProDashboard from "./pages/ProDashboard";
import Earnings from "./pages/Earnings";
import TenantProPage from "./pages/TenantProPage";
import AuthLayout from "./layout/AuthLayout";
import ServiceUpsell from "./features/postsign/ServiceUpsell";
import TenantHome from "./pages/tenant/TenantHome";
import AdminHome from "./pages/admin/AdminHome";
import TenantPayments from "./pages/tenant/Payments";
import TenantApplications from "./pages/tenant/Applications";
import TenantKyc from "./pages/tenant/Kyc";
import LandlordPayments from "./pages/landlord/Payments";
import LandlordIssues from "./pages/landlord/Issues";
import LandlordServices from "./pages/landlord/Services";
import LandlordShowings from "./pages/landlord/Showings";
import ProProfile from "./pages/pro/Profile";
import ProQuotes from "./pages/pro/Quotes";
import ProBilling from "./pages/pro/Billing";
import ProfilePage from "./pages/profile/ProfilePage";
import ProList from "./pages/ProList";
import ProDetail from "./pages/ProDetail";
import ContractDetail from "./pages/ContractDetail";

export default function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<RedirectHome />} />
            <Route path="/properties" element={<PropertiesList />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/tenant" element={<ProtectedRoute><RoleGuard roles={["tenant"]}><TenantHome /></RoleGuard></ProtectedRoute>} />
            <Route path="/tenant/payments" element={<ProtectedRoute><RoleGuard roles={["tenant"]}><TenantPayments /></RoleGuard></ProtectedRoute>} />
            <Route path="/tenant/applications" element={<ProtectedRoute><RoleGuard roles={["tenant"]}><TenantApplications /></RoleGuard></ProtectedRoute>} />
            <Route path="/tenant/kyc" element={<ProtectedRoute><RoleGuard roles={["tenant"]}><TenantKyc /></RoleGuard></ProtectedRoute>} />
            <Route path="/landlord" element={<ProtectedRoute><RoleGuard roles={["landlord"]}><LandlordDashboard /></RoleGuard></ProtectedRoute>} />
            <Route path="/landlord/payments" element={<ProtectedRoute><RoleGuard roles={["landlord"]}><LandlordPayments /></RoleGuard></ProtectedRoute>} />
            <Route path="/landlord/issues" element={<ProtectedRoute><RoleGuard roles={["landlord"]}><LandlordIssues /></RoleGuard></ProtectedRoute>} />
            <Route path="/landlord/services" element={<ProtectedRoute><RoleGuard roles={["landlord"]}><LandlordServices /></RoleGuard></ProtectedRoute>} />
            <Route path="/landlord/showings" element={<ProtectedRoute><RoleGuard roles={["landlord"]}><LandlordShowings /></RoleGuard></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><RoleGuard roles={["admin"]}><AdminHome /></RoleGuard></ProtectedRoute>} />
            <Route
              path="/tenant-pro"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["tenant"]}>
                    <TenantProPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contracts"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["tenant", "landlord", "admin"]}>
                    <MyContracts />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contracts/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["tenant", "landlord", "admin"]}>
                    <ContractDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/contracts/:id/signed" element={<ServiceUpsell />} />
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

            <Route path="/owner/properties" element={<ProtectedRoute><RoleGuard roles={["landlord"]}><LandlordDashboard /></RoleGuard></ProtectedRoute>} />
            <Route
              path="/pro"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["pro"]}>
                    <ProDashboard />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pro/tickets"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["pro"]}>
                    <TicketsList />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/pro/profile" element={<ProtectedRoute><RoleGuard roles={["pro"]}><ProProfile /></RoleGuard></ProtectedRoute>} />
            <Route path="/pro/quotes" element={<ProtectedRoute><RoleGuard roles={["pro"]}><ProQuotes /></RoleGuard></ProtectedRoute>} />
            <Route path="/pro/billing" element={<ProtectedRoute><RoleGuard roles={["pro"]}><ProBilling /></RoleGuard></ProtectedRoute>} />
            <Route path="/earnings" element={<ProtectedRoute><RoleGuard roles={["admin", "landlord"]}><Earnings /></RoleGuard></ProtectedRoute>} />
            <Route
              path="/admin/tenant-pro"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["admin"]}>
                    <AdminTenantProPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["admin"]}>
                    <AdminUsersPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/properties"
              element={
                <ProtectedRoute>
                  <RoleGuard roles={["admin"]}>
                    <AdminPropertiesPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route path="/admin/reports" element={<ProtectedRoute><RoleGuard roles={["admin"]}><AdminReports /></RoleGuard></ProtectedRoute>} />
            <Route path="/admin/incidents" element={<ProtectedRoute><RoleGuard roles={["admin"]}><AdminIncidents /></RoleGuard></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute><RoleGuard roles={["admin"]}><AdminSettings /></RoleGuard></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute><RoleGuard roles={["admin"]}><AdminPayments /></RoleGuard></ProtectedRoute>} />

            {/* Public catalog for pros */}
            <Route path="/pros" element={<ProList />} />
            <Route path="/pros/:id" element={<ProDetail />} />

            {/* Profile */}
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset" element={<ResetPassword />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
