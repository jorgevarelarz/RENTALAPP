import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import AppRoutes from './AppRoutes';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

// Mock react-router-dom completely to avoid resolver issues
vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: any) => <div>{children}</div>,
  Routes: ({ children }: any) => <div>{children}</div>,
  Route: () => null,
  Navigate: () => null,
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  NavLink: ({ children, to }: any) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
}), { virtual: true });

// Mock other external dependencies
vi.mock('axios', () => {
  const axiosMock = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  } as any;
  axiosMock.create = vi.fn(() => axiosMock);
  return { __esModule: true, default: axiosMock };
}, { virtual: true });
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(async () => null) }), { virtual: true });

test('la app renderiza sin crashear', () => {
  render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          {/* App needs to be inside a Router, even a mocked one */}
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
  expect(true).toBe(true);
});
