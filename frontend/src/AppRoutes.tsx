import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import AppShell from "./layout/AppShell";
import PublicLayout from "./layout/PublicLayout";
import AuthLayout from "./layout/AuthLayout";

type UserRole = "tenant" | "landlord" | "pro" | "admin" | "agency";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForbiddenPage = lazy(() => import("./pages/system/ForbiddenPage"));
const PropertiesList = lazy(() => import("./pages/properties/PropertiesList"));
const PropertyDetail = lazy(() => import("./pages/properties/PropertyDetail"));
const FavoritesPage = lazy(() => import("./pages/properties/FavoritesPage"));
const ContractWizard = lazy(() => import("./pages/contracts/ContractWizard"));
const Inbox = lazy(() => import("./pages/Inbox"));
const ChatDirectPage = lazy(() => import("./pages/ChatDirect"));
const TicketsList = lazy(() => import("./pages/tickets/TicketsList"));
const TicketCreatePage = lazy(() => import("./pages/tickets/TicketCreatePage"));
const TicketDetail = lazy(() => import("./pages/tickets/TicketDetail"));
const AdminTenantProPage = lazy(() => import("./pages/admin/AdminTenantProPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminPropertiesPage = lazy(() => import("./pages/admin/AdminPropertiesPage"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminIncidents = lazy(() => import("./pages/admin/Incidents"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const AdminCompliancePage = lazy(() => import("./pages/admin/AdminCompliancePage"));
const ComplianceDashboard = lazy(() => import("./pages/admin/ComplianceDashboard"));
const TensionedAreas = lazy(() => import("./pages/admin/TensionedAreas"));
const SystemEvents = lazy(() => import("./pages/admin/SystemEvents"));
const AdminAuditDashboard = lazy(() => import("./pages/admin/AdminAuditDashboard"));
const RedirectHome = lazy(() => import("./pages/RedirectHome"));
const MyContracts = lazy(() => import("./pages/MyContracts"));
const LandlordDashboard = lazy(() => import("./pages/LandlordDashboard"));
const ProDashboard = lazy(() => import("./pages/ProDashboard"));
const Earnings = lazy(() => import("./pages/Earnings"));
const TenantProPage = lazy(() => import("./pages/TenantProPage"));
const ServiceUpsell = lazy(() => import("./features/postsign/ServiceUpsell"));
const TenantHome = lazy(() => import("./pages/tenant/TenantHome"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const TenantPayments = lazy(() => import("./pages/tenant/Payments"));
const TenantApplications = lazy(() => import("./pages/tenant/Applications"));
const TenantKyc = lazy(() => import("./pages/tenant/Kyc"));
const LandlordPayments = lazy(() => import("./pages/landlord/Payments"));
const LandlordIssues = lazy(() => import("./pages/landlord/Issues"));
const LandlordServices = lazy(() => import("./pages/landlord/Services"));
const LandlordShowings = lazy(() => import("./pages/landlord/Showings"));
const ProProfile = lazy(() => import("./pages/pro/Profile"));
const ProQuotes = lazy(() => import("./pages/pro/Quotes"));
const ProBilling = lazy(() => import("./pages/pro/Billing"));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));
const ProList = lazy(() => import("./pages/ProList"));
const ProDetail = lazy(() => import("./pages/ProDetail"));
const ContractDetail = lazy(() => import("./pages/ContractDetail"));
const AssistantPage = lazy(() => import("./pages/Assistant"));
const InboundTestingPage = lazy(() => import("./pages/testing/InboundTestingPage"));
const AgencyHome = lazy(() => import("./pages/agency/AgencyHome"));
const AgencyLandlords = lazy(() => import("./pages/agency/AgencyLandlords"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));

function RouteFallback() {
  return <div className="p-6 text-sm text-gray-500">Cargando...</div>;
}

function withProtected(children: React.ReactElement, roles?: UserRole[]) {
  const guarded = roles ? <RoleGuard roles={roles}>{children}</RoleGuard> : children;
  return <ProtectedRoute>{guarded}</ProtectedRoute>;
}

export default function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<RedirectHome />} />
              <Route path="/testing/inbound" element={<InboundTestingPage />} />
            </Route>

            <Route element={<AppShell />}>
              <Route path="/properties" element={<PropertiesList />} />
              <Route path="/properties/:id" element={<PropertyDetail />} />
              <Route path="/inbox" element={withProtected(<Inbox />)} />
              <Route path="/inbox/:userId" element={withProtected(<ChatDirectPage />)} />
              <Route path="/assistant" element={withProtected(<AssistantPage />)} />
              <Route path="/tenant" element={withProtected(<TenantHome />, ["tenant"])} />
              <Route path="/tenant/payments" element={withProtected(<TenantPayments />, ["tenant"])} />
              <Route path="/tenant/applications" element={withProtected(<TenantApplications />, ["tenant"])} />
              <Route path="/tenant/kyc" element={withProtected(<TenantKyc />, ["tenant"])} />
              <Route path="/landlord" element={withProtected(<LandlordDashboard />, ["landlord"])} />
              <Route path="/landlord/payments" element={withProtected(<LandlordPayments />, ["landlord"])} />
              <Route path="/landlord/issues" element={withProtected(<LandlordIssues />, ["landlord"])} />
              <Route path="/landlord/services" element={withProtected(<LandlordServices />, ["landlord"])} />
              <Route path="/landlord/showings" element={withProtected(<LandlordShowings />, ["landlord"])} />
              <Route path="/admin" element={withProtected(<AdminHome />, ["admin"])} />
              <Route path="/tenant-pro" element={withProtected(<TenantProPage />, ["tenant"])} />
              <Route path="/contracts" element={withProtected(<MyContracts />, ["tenant", "landlord", "admin"])} />
              <Route path="/contracts/:id" element={withProtected(<ContractDetail />, ["tenant", "landlord", "admin"])} />
              <Route path="/contracts/:id/signed" element={<ServiceUpsell />} />
              <Route path="/me/favorites" element={withProtected(<FavoritesPage />, ["tenant", "landlord", "admin"])} />
              <Route path="/contracts/new" element={withProtected(<ContractWizard />, ["landlord", "admin"])} />
              <Route path="/tickets" element={withProtected(<TicketsList />)} />
              <Route path="/tickets/new" element={withProtected(<TicketCreatePage />, ["tenant", "landlord", "admin"])} />
              <Route path="/tickets/:id" element={withProtected(<TicketDetail />)} />
              <Route path="/owner/properties" element={withProtected(<LandlordDashboard />, ["landlord"])} />
              <Route path="/pro" element={withProtected(<ProDashboard />, ["pro"])} />
              <Route path="/pro/tickets" element={withProtected(<TicketsList />, ["pro"])} />
              <Route path="/pro/profile" element={withProtected(<ProProfile />, ["pro"])} />
              <Route path="/pro/quotes" element={withProtected(<ProQuotes />, ["pro"])} />
              <Route path="/pro/billing" element={withProtected(<ProBilling />, ["pro"])} />
              <Route path="/earnings" element={withProtected(<Earnings />, ["admin", "landlord"])} />
              <Route path="/admin/tenant-pro" element={withProtected(<AdminTenantProPage />, ["admin"])} />
              <Route path="/admin/users" element={withProtected(<AdminUsersPage />, ["admin"])} />
              <Route path="/admin/properties" element={withProtected(<AdminPropertiesPage />, ["admin"])} />
              <Route path="/admin/reports" element={withProtected(<AdminReports />, ["admin"])} />
              <Route path="/admin/incidents" element={withProtected(<AdminIncidents />, ["admin"])} />
              <Route path="/admin/settings" element={withProtected(<AdminSettings />, ["admin"])} />
              <Route path="/admin/payments" element={withProtected(<AdminPayments />, ["admin"])} />
              <Route path="/admin/compliance" element={withProtected(<ComplianceDashboard />, ["admin"])} />
              <Route path="/admin/compliance/policies" element={withProtected(<AdminCompliancePage />, ["admin"])} />
              <Route path="/admin/compliance/tensioned-areas" element={withProtected(<TensionedAreas />, ["admin"])} />
              <Route path="/admin/compliance/audit-trails" element={withProtected(<AdminAuditDashboard />, ["admin"])} />
              <Route path="/admin/system-events" element={withProtected(<SystemEvents />, ["admin"])} />
              <Route path="/agency" element={withProtected(<AgencyHome />, ["agency"])} />
              <Route path="/agency/landlords" element={withProtected(<AgencyLandlords />, ["agency"])} />
              <Route path="/pros" element={<ProList />} />
              <Route path="/pros/:id" element={<ProDetail />} />
              <Route path="/profile" element={withProtected(<ProfilePage />)} />
              <Route path="/403" element={<ForbiddenPage />} />
              <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
            </Route>

            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset" element={<ResetPassword />} />
              <Route path="/invite/:token" element={<InviteAccept />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
