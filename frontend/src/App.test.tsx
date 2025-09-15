import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from './App';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

type RouterContextValue = { location: string; navigate: (to: string) => void };

jest.mock('react-router-dom', () => {
  const React = require('react') as typeof import('react');
  const RouterContext = React.createContext<RouterContextValue>({ location: '/', navigate: () => undefined });

  const normalize = (value: string) => (value.startsWith('/') ? value : `/${value}`);
  const matches = (path: string, current: string) => {
    const target = normalize(path);
    const location = normalize(current);
    if (target === '/*') return true;
    if (target === location) return true;
    if (target.endsWith('/*')) {
      const base = target.slice(0, -2);
      return location === base || location.startsWith(`${base}/`);
    }
    const targetParts = target.split('/').filter(Boolean);
    const locationParts = location.split('/').filter(Boolean);
    if (targetParts.length !== locationParts.length) return false;
    return targetParts.every((segment, index) => segment.startsWith(':') || segment === locationParts[index]);
  };

  const MemoryRouter: React.FC<{ initialEntries?: string[]; children: React.ReactNode }> = ({ initialEntries = ['/'], children }) => {
    const [location, setLocation] = React.useState<string>(initialEntries[0] || '/');
    const navigate = React.useCallback((to: string) => setLocation(normalize(to)), []);
    const value = React.useMemo<RouterContextValue>(() => ({ location, navigate }), [location, navigate]);
    return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
  };

  const Routes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { location } = React.useContext(RouterContext);
    let element: React.ReactNode = null;
    React.Children.forEach(children, child => {
      if (element || !React.isValidElement(child)) return;
      const { path, element: routeElement } = child.props as { path: string; element: React.ReactNode };
      if (matches(path, location)) element = routeElement;
    });
    return <>{element}</>;
  };

  const Route: React.FC<{ path: string; element: React.ReactNode }> = () => null;

  const Navigate: React.FC<{ to: string }> = ({ to }) => {
    const { navigate, location } = React.useContext(RouterContext);
    React.useEffect(() => {
      if (location !== normalize(to)) navigate(to);
    }, [navigate, to, location]);
    return null;
  };

  const useNavigate = () => React.useContext(RouterContext).navigate;
  const useLocation = () => ({ pathname: React.useContext(RouterContext).location });
  const Link: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => <a href={to}>{children}</a>;
  const NavLink = Link;

  return {
    __esModule: true,
    MemoryRouter,
    Routes,
    Route,
    Navigate,
    useNavigate,
    useLocation,
    Link,
    NavLink,
    BrowserRouter: MemoryRouter,
  };
}, { virtual: true });

const mockDecodeJwt = jest.fn(() => ({ id: 'user-id', role: 'tenant' }));

jest.mock('./utils/jwt', () => ({
  __esModule: true,
  decodeJwt: (...args: unknown[]) => mockDecodeJwt(...args),
}));

jest.mock('./components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./pages/Login', () => {
  const React = require('react') as typeof import('react');
  const { useNavigate } = require('react-router-dom') as typeof import('react-router-dom');
  const Login: React.FC = () => {
    const navigate = useNavigate();
    React.useEffect(() => {
      if (globalThis.localStorage?.getItem('token')) navigate('/dashboard', { replace: true });
    }, [navigate]);
    return <div>Login Page</div>;
  };
  return { __esModule: true, default: Login };
});

jest.mock('./pages/TenantDashboard', () => ({
  __esModule: true,
  default: () => <div>Tenant Dashboard</div>,
}));

jest.mock('./pages/LandlordDashboard', () => ({
  __esModule: true,
  default: () => <div>Landlord Dashboard</div>,
}));

jest.mock('./pages/ProDashboard', () => ({
  __esModule: true,
  default: () => <div>Pro Dashboard</div>,
}));

jest.mock('./pages/PropertyList', () => ({
  __esModule: true,
  default: () => <div>Property List</div>,
}));

jest.mock('./pages/PropertyDetail', () => ({
  __esModule: true,
  default: () => <div>Property Detail</div>,
}));

jest.mock('./pages/MyContracts', () => ({
  __esModule: true,
  default: () => <div>My Contracts</div>,
}));

jest.mock('./pages/Verification', () => ({
  __esModule: true,
  default: () => <div>Verification</div>,
}));

jest.mock('./pages/ContractDetail', () => ({
  __esModule: true,
  default: () => <div>Contract Detail</div>,
}));

jest.mock('./pages/NotFound', () => ({
  __esModule: true,
  default: () => <div>Not Found</div>,
}));

jest.mock('./pages/Earnings', () => ({
  __esModule: true,
  default: () => <div>Earnings</div>,
}));

jest.mock('./pages/Favorites', () => ({
  __esModule: true,
  default: () => <div>Favorites</div>,
}));

jest.mock('./pages/ProList', () => ({
  __esModule: true,
  default: () => <div>Pro List</div>,
}));

jest.mock('./pages/ProDetail', () => ({
  __esModule: true,
  default: () => <div>Pro Detail</div>,
}));

jest.mock('./pages/common/Placeholder', () => ({
  __esModule: true,
  default: () => <div>Placeholder</div>,
}));

jest.mock('./pages/common/AutoPlaceholder', () => ({
  __esModule: true,
  default: () => <div>Auto Placeholder</div>,
}));

const AuthInitializer: React.FC<{ token?: string; children: React.ReactNode }> = ({ token, children }) => {
  const { login, logout } = useAuth();
  React.useLayoutEffect(() => {
    if (token) login(token);
    else logout();
  }, [token, login, logout]);
  return <>{children}</>;
};

const LocationDisplay: React.FC = () => {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
};

const renderApp = (initialEntries: string[], token?: string) => render(
  <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <AuthInitializer token={token}>
          <MemoryRouter initialEntries={initialEntries}>
            <App />
            <LocationDisplay />
          </MemoryRouter>
        </AuthInitializer>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);

describe('App routing', () => {
  beforeEach(() => {
    mockDecodeJwt.mockClear();
    localStorage.clear();
  });

  test('redirects unauthenticated users from /dashboard to /login', async () => {
    renderApp(['/dashboard']);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Tenant Dashboard')).not.toBeInTheDocument();
  });

  test('redirects authenticated users from /login to /dashboard', async () => {
    renderApp(['/login'], 'valid.token.value');

    await waitFor(() => {
      expect(mockDecodeJwt).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    });
    await waitFor(() => {
      expect(screen.getByText('Tenant Dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
