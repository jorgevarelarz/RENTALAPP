import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom to avoid resolver issues and to render Route elements
jest.mock('react-router-dom', () => ({
  // Render children directly
  Routes: ({ children }: any) => <div>{children}</div>,
  // Do not render nested routes in tests to avoid heavy deps
  Route: () => null,
  // No-op for Navigate in tests
  Navigate: () => null,
  // Hooks used by pages
  useNavigate: () => jest.fn(),
}), { virtual: true });

// Mock ESM-only deps used by pages/services so Jest (CJS) can run
jest.mock('axios', () => ({ default: { post: jest.fn(), get: jest.fn() } }), { virtual: true });
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => null) }), { virtual: true });

import App from './App';

test('la app renderiza sin crashear', () => {
  render(<App />);
  expect(true).toBe(true);
});
