import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom to avoid resolver issues and to render Route elements
jest.mock('react-router-dom', () => ({
  // Render children directly
  Routes: ({ children }: any) => <div>{children}</div>,
  // Do not render nested routes in tests to avoid heavy deps
  Route: () => null,
  // Outlet simply renders children
  Outlet: ({ children }: any) => <div>{children}</div>,
  // Minimal link components
  Link: ({ children }: any) => <span>{children}</span>,
  NavLink: ({ children }: any) => <span>{children}</span>,
  // No-op for Navigate in tests
  Navigate: () => null,
  // Hooks used by pages
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
}), { virtual: true });

// Mock ESM-only deps used by pages/services so Jest (CJS) can run
jest.mock('axios', () => ({ default: { post: jest.fn(), get: jest.fn() } }), { virtual: true });
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => null) }), { virtual: true });

import App from './App';
import { AuthProvider } from './auth/AuthContext';

test('la app renderiza sin crashear', () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
  expect(true).toBe(true);
});
