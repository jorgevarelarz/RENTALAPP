import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from '../../auth/guards/RequireAuth';
import RequireRole from '../../auth/guards/RequireRole';
import RoleLayout from '../../layouts/RoleLayout';
import { UserRole } from '../store/authSlice';
import LoginPage from '../../auth/LoginPage';
import RegisterPage from '../../auth/RegisterPage';
import NotFoundPage from '../../pages/common/NotFoundPage';
import { useAppSelector } from '../hooks';
import { NoAccess } from '../../layouts/RoleLayout';

const TenantHomePage = lazy(() => import('../../pages/tenant/HomePage'));
const TenantSearchPage = lazy(() => import('../../pages/tenant/SearchPage'));
const TenantApplicationsPage = lazy(() => import('../../pages/tenant/ApplicationsPage'));
const TenantContractsPage = lazy(() => import('../../pages/tenant/ContractsPage'));
const TenantPaymentsPage = lazy(() => import('../../pages/tenant/Payments'));
const TenantIncidentsPage = lazy(() => import('../../pages/tenant/IncidentsPage'));
const TenantProfilePage = lazy(() => import('../../pages/tenant/ProfilePage'));
const TenantKycPage = lazy(() => import('../../pages/tenant/KycPage'));
const TenantProBadgePage = lazy(() => import('../../pages/tenant/ProBadgePage'));
const TenantPostServicesPage = lazy(() => import('../../pages/tenant/PostServicesPage'));

const LandlordHomePage = lazy(() => import('../../pages/landlord/HomePage'));
const LandlordPropertiesPage = lazy(() => import('../../pages/landlord/PropertiesPage'));
const LandlordRequestsPage = lazy(() => import('../../pages/landlord/RequestsPage'));
const LandlordCandidatesPage = lazy(() => import('../../pages/landlord/CandidatesPage'));
const LandlordContractsPage = lazy(() => import('../../pages/landlord/ContractsPage'));
const LandlordDepositsPage = lazy(() => import('../../pages/landlord/DepositsPage'));
const LandlordPaymentsPage = lazy(() => import('../../pages/landlord/PaymentsPage'));
const LandlordIncidentsPage = lazy(() => import('../../pages/landlord/IncidentsPage'));
const LandlordProfessionalsPage = lazy(() => import('../../pages/landlord/ProfessionalsPage'));
const LandlordTaxPage = lazy(() => import('../../pages/landlord/TaxPage'));

const ProfessionalHomePage = lazy(() => import('../../pages/professional/HomePage'));
const ProfessionalOffersPage = lazy(() => import('../../pages/professional/OffersPage'));
const ProfessionalJobsPage = lazy(() => import('../../pages/professional/JobsPage'));
const ProfessionalBillingPage = lazy(() => import('../../pages/professional/BillingPage'));
const ProfessionalReputationPage = lazy(() => import('../../pages/professional/ReputationPage'));

const AgencyHomePage = lazy(() => import('../../pages/agency/HomePage'));
const AgencyVisitsPage = lazy(() => import('../../pages/agency/VisitsPage'));
const AgencyCapturePage = lazy(() => import('../../pages/agency/CapturePage'));
const AgencyContractsPage = lazy(() => import('../../pages/agency/ContractsPage'));
const AgencyCommissionsPage = lazy(() => import('../../pages/agency/CommissionsPage'));

const AdminDashboardPage = lazy(() => import('../../pages/admin/DashboardPage'));
const AdminUsersPage = lazy(() => import('../../pages/admin/UsersPage'));
const AdminPaymentsPage = lazy(() => import('../../pages/admin/PaymentsPage'));
const AdminDepositsPage = lazy(() => import('../../pages/admin/DepositsPage'));
const AdminCatalogPage = lazy(() => import('../../pages/admin/CatalogPage'));
const AdminLegalPage = lazy(() => import('../../pages/admin/LegalPage'));

const Loader: React.FC = () => (
  <div style={{ padding: 32 }}>
    <p>Cargando…</p>
  </div>
);

const RoleGateway: React.FC<{ children: React.ReactElement; roles: UserRole[] }> = ({ children, roles }) => (
  <RequireAuth>
    <RequireRole roles={roles}>{children}</RequireRole>
  </RequireAuth>
);

const RoleAwareRedirect: React.FC = () => {
  const user = useAppSelector(state => state.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  const homeByRole: Record<UserRole, string> = {
    TENANT: '/tenant/home',
    LANDLORD: '/landlord/home',
    PROFESSIONAL: '/professional/home',
    AGENCY: '/agency/home',
    ADMIN: '/admin/dashboard',
  };
  return <Navigate to={homeByRole[user.activeRole]} replace />;
};

const AppRouter: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<RoleAwareRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<RoleGateway roles={['TENANT', 'LANDLORD', 'PROFESSIONAL', 'AGENCY', 'ADMIN']}><RoleLayout /></RoleGateway>}>
          {/* Tenant */}
          <Route path="/tenant/home" element={<RequireRole roles={['TENANT']}><TenantHomePage /></RequireRole>} />
          <Route path="/tenant/search" element={<RequireRole roles={['TENANT']}><TenantSearchPage /></RequireRole>} />
          <Route path="/tenant/applications" element={<RequireRole roles={['TENANT']}><TenantApplicationsPage /></RequireRole>} />
          <Route path="/tenant/contracts" element={<RequireRole roles={['TENANT']}><TenantContractsPage /></RequireRole>} />
          <Route path="/tenant/payments" element={<RequireRole roles={['TENANT']}><TenantPaymentsPage /></RequireRole>} />
          <Route path="/tenant/incidents" element={<RequireRole roles={['TENANT']}><TenantIncidentsPage /></RequireRole>} />
          <Route path="/tenant/profile" element={<RequireRole roles={['TENANT']}><TenantProfilePage /></RequireRole>} />
          <Route path="/tenant/profile/kyc" element={<RequireRole roles={['TENANT']}><TenantKycPage /></RequireRole>} />
          <Route path="/tenant/profile/pro" element={<RequireRole roles={['TENANT']}><TenantProBadgePage /></RequireRole>} />
          <Route path="/tenant/services" element={<RequireRole roles={['TENANT']}><TenantPostServicesPage /></RequireRole>} />

          {/* Landlord */}
          <Route path="/landlord/home" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordHomePage /></RequireRole>} />
          <Route path="/landlord/properties" element={<RequireRole roles={['LANDLORD', 'AGENCY', 'ADMIN']}><LandlordPropertiesPage /></RequireRole>} />
          <Route path="/landlord/requests" element={<RequireRole roles={['LANDLORD', 'AGENCY', 'ADMIN']}><LandlordRequestsPage /></RequireRole>} />
          <Route path="/landlord/candidates" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordCandidatesPage /></RequireRole>} />
          <Route path="/landlord/contracts" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordContractsPage /></RequireRole>} />
          <Route path="/landlord/deposits" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordDepositsPage /></RequireRole>} />
          <Route path="/landlord/payments" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordPaymentsPage /></RequireRole>} />
          <Route path="/landlord/incidents" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordIncidentsPage /></RequireRole>} />
          <Route path="/landlord/professionals" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordProfessionalsPage /></RequireRole>} />
          <Route path="/landlord/tax" element={<RequireRole roles={['LANDLORD', 'ADMIN']}><LandlordTaxPage /></RequireRole>} />

          {/* Professional */}
          <Route path="/professional/home" element={<RequireRole roles={['PROFESSIONAL', 'ADMIN']}><ProfessionalHomePage /></RequireRole>} />
          <Route path="/professional/offers" element={<RequireRole roles={['PROFESSIONAL', 'ADMIN']}><ProfessionalOffersPage /></RequireRole>} />
          <Route path="/professional/jobs" element={<RequireRole roles={['PROFESSIONAL', 'ADMIN']}><ProfessionalJobsPage /></RequireRole>} />
          <Route path="/professional/billing" element={<RequireRole roles={['PROFESSIONAL', 'ADMIN']}><ProfessionalBillingPage /></RequireRole>} />
          <Route path="/professional/reputation" element={<RequireRole roles={['PROFESSIONAL', 'ADMIN']}><ProfessionalReputationPage /></RequireRole>} />

          {/* Agency */}
          <Route path="/agency/home" element={<RequireRole roles={['AGENCY', 'ADMIN']}><AgencyHomePage /></RequireRole>} />
          <Route path="/agency/visits" element={<RequireRole roles={['AGENCY', 'ADMIN']}><AgencyVisitsPage /></RequireRole>} />
          <Route path="/agency/capture" element={<RequireRole roles={['AGENCY', 'ADMIN']}><AgencyCapturePage /></RequireRole>} />
          <Route path="/agency/contracts" element={<RequireRole roles={['AGENCY', 'ADMIN']}><AgencyContractsPage /></RequireRole>} />
          <Route path="/agency/commissions" element={<RequireRole roles={['AGENCY', 'ADMIN']}><AgencyCommissionsPage /></RequireRole>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<RequireRole roles={['ADMIN']}><AdminDashboardPage /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole roles={['ADMIN']}><AdminUsersPage /></RequireRole>} />
          <Route path="/admin/payments" element={<RequireRole roles={['ADMIN']}><AdminPaymentsPage /></RequireRole>} />
          <Route path="/admin/deposits" element={<RequireRole roles={['ADMIN']}><AdminDepositsPage /></RequireRole>} />
          <Route path="/admin/catalog" element={<RequireRole roles={['ADMIN']}><AdminCatalogPage /></RequireRole>} />
          <Route path="/admin/legal" element={<RequireRole roles={['ADMIN']}><AdminLegalPage /></RequireRole>} />
        </Route>

        <Route path="/403" element={<NoAccess />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
