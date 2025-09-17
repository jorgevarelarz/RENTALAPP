import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import PropertyList from './pages/PropertyList';
import PropertyDetail from './pages/PropertyDetail';
import LandlordDashboard from './pages/LandlordDashboard';
import TenantDashboard from './pages/TenantDashboard';
import { useAuth } from './context/AuthContext';
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
import ContractWizard from './pages/contracts/ContractWizard';

const ProtectedRoute: React.FC<{ children: React.ReactElement; roles?: Array<'tenant'|'landlord'|'admin'|'pro'> }> = ({ children, roles }) => {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const App: React.FC = () => {
  const { user } = useAuth();
  const dashboard = user?.role === 'landlord'
    ? <LandlordDashboard />
    : user?.role === 'pro'
      ? <ProDashboard />
      : <TenantDashboard />;
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute>{dashboard}</ProtectedRoute>} />
        <Route path="/landlord/properties" element={<ProtectedRoute roles={['landlord','admin']}><LandlordDashboard /></ProtectedRoute>} />
        <Route path="/contracts" element={<ProtectedRoute><MyContracts /></ProtectedRoute>} />
        <Route path="/contracts/new" element={<ProtectedRoute><ContractWizard /></ProtectedRoute>} />
        <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />
        <Route path="/earnings" element={<ProtectedRoute roles={['landlord','admin']}><Earnings /></ProtectedRoute>} />
        <Route path="/pro" element={<ProtectedRoute roles={['pro','admin']}><ProDashboard /></ProtectedRoute>} />
        <Route path="/pros" element={<ProList />} />
        <Route path="/pros/:id" element={<ProDetail />} />
        <Route path="/favorites" element={<ProtectedRoute roles={['tenant','landlord','admin']}><Favorites /></ProtectedRoute>} />
        <Route path="/verify" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
        <Route path="/p/:id" element={<PropertyDetail />} />
        {/* Role catch-alls to evitar 404 mientras se completa cada sección */}
        <Route path="/tenant/*" element={<ProtectedRoute roles={['tenant']}><AutoPlaceholder /></ProtectedRoute>} />
        <Route path="/landlord/*" element={<ProtectedRoute roles={['landlord']}><AutoPlaceholder /></ProtectedRoute>} />
        <Route path="/pro/*" element={<ProtectedRoute roles={['pro']}><AutoPlaceholder /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute roles={['admin']}><AutoPlaceholder /></ProtectedRoute>} />
        <Route path="/" element={<PropertyList />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

export default App;
