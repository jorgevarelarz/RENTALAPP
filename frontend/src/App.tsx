import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PrivateRoute from './auth/PrivateRoute';
import PublicOnlyRoute from './auth/PublicOnlyRoute';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import PropertyList from './pages/PropertyList';
import PropertyDetail from './pages/PropertyDetail';
import LandlordDashboard from './pages/LandlordDashboard';
import TenantDashboard from './pages/TenantDashboard';
import MyContracts from './pages/MyContracts';
import Verification from './pages/Verification';
import ContractDetail from './pages/ContractDetail';
import NotFound from './pages/NotFound';
import Earnings from './pages/Earnings';
import Favorites from './pages/Favorites';
import ProDashboard from './pages/ProDashboard';
import ProList from './pages/ProList';
import ProDetail from './pages/ProDetail';
import Placeholder from './pages/common/Placeholder';
import AutoPlaceholder from './pages/common/AutoPlaceholder';
import { useAuth } from './auth/AuthContext';

const App: React.FC = () => {
  const { user } = useAuth();

  const dashboard = user?.role === 'landlord'
    ? <LandlordDashboard />
    : user?.role === 'pro'
      ? <ProDashboard />
      : <TenantDashboard />;

  const renderWithRoles = (
    roles: Array<'tenant' | 'landlord' | 'admin' | 'pro'> | undefined,
    element: React.ReactElement,
  ) => {
    if (!roles || roles.length === 0) return element;
    if (user && roles.includes(user.role)) return element;
    return <Navigate to="/dashboard" replace />;
  };

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<PropertyList />} />
          <Route path="/properties" element={<PropertyList />} />
          <Route path="/dashboard" element={dashboard} />
          <Route
            path="/landlord/properties"
            element={renderWithRoles(['landlord', 'admin'], <LandlordDashboard />)}
          />
          <Route path="/contracts" element={<MyContracts />} />
          <Route path="/contracts/:id" element={<ContractDetail />} />
          <Route
            path="/earnings"
            element={renderWithRoles(['landlord', 'admin'], <Earnings />)}
          />
          <Route path="/pro" element={renderWithRoles(['pro', 'admin'], <ProDashboard />)} />
          <Route path="/pros" element={<ProList />} />
          <Route path="/pros/:id" element={<ProDetail />} />
          <Route
            path="/favorites"
            element={renderWithRoles(['tenant', 'landlord', 'admin'], <Favorites />)}
          />
          <Route path="/verify" element={<Verification />} />
          <Route path="/p/:id" element={<PropertyDetail />} />
          <Route
            path="/placeholder"
            element={(
              <Placeholder
                title="Sección en construcción"
                subtitle="Estamos preparando esta vista."
              />
            )}
          />
          <Route path="/tenant/*" element={renderWithRoles(['tenant'], <AutoPlaceholder />)} />
          <Route path="/landlord/*" element={renderWithRoles(['landlord'], <AutoPlaceholder />)} />
          <Route path="/pro/*" element={renderWithRoles(['pro'], <AutoPlaceholder />)} />
          <Route path="/admin/*" element={renderWithRoles(['admin'], <AutoPlaceholder />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
