import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
// Mock router primitives used by Sidebar
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to }: any) => <a href={to}>{children}</a>,
}), { virtual: true });

vi.mock('axios', () => {
  const axiosMock = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  } as any;
  axiosMock.create = vi.fn(() => axiosMock);
  return { __esModule: true, default: axiosMock };
}, { virtual: true });

let currentRole: any = null;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: (global as any).__mockRole ? { role: (global as any).__mockRole } : null })
}), { virtual: true });

import Sidebar from '../components/Sidebar';

function renderWithRole(role: any) {
  (global as any).__mockRole = role;
  return render(<div><Sidebar /></div>);
}

test('Sidebar shows only tenant menu for tenant', () => {
renderWithRole('tenant');
  expect(screen.getByText('Inicio')).toBeInTheDocument();
  expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
});

// RoleGuard redirections are covered indirectly via router in AppRoutes tests
