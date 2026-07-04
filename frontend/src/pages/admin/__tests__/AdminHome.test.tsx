import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminHome from '../AdminHome';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: { get: getMock },
  formatApiError: vi.fn(() => 'No se pudo cargar el panel admin'),
}));

describe('AdminHome', () => {
  beforeEach(() => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/requests')) {
        return Promise.resolve({
          data: {
            items: [{ _id: 'req-1', type: 'tenant_pro', status: 'pending', createdAt: '2026-01-01T10:00:00Z' }],
          },
        });
      }

      return Promise.resolve({
        data: {
          users: { total: 12, tenants: 7, landlords: 4, admins: 1 },
          properties: 9,
          contracts: { total: 5, draft: 2, active: 3, completed: 0, cancelled: 0 },
        },
      });
    });
  });

  it('renders operational stats and quick links', async () => {
    render(
      <MemoryRouter>
        <AdminHome />
      </MemoryRouter>,
    );

    expect(screen.getByText('Centro de mando admin')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('KYC / Tenant PRO')).toBeInTheDocument();
    expect(screen.getByText('tenant_pro')).toBeInTheDocument();
  });
});
