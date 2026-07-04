import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantHome from '../TenantHome';

const { listContractsMock, getFavoritesMock } = vi.hoisted(() => ({
  listContractsMock: vi.fn(),
  getFavoritesMock: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'token-1',
    user: {
      _id: 'tenant-1',
      email: 'ana@example.com',
      name: 'Ana Garcia',
      role: 'tenant',
      tenantPro: { status: 'verified' },
    },
  }),
}));

vi.mock('../../../services/contracts', () => ({
  listContracts: listContractsMock,
}));

vi.mock('../../../utils/favorites', () => ({
  getFavorites: getFavoritesMock,
}));

describe('TenantHome', () => {
  beforeEach(() => {
    getFavoritesMock.mockReturnValue(['p1', 'p2']);
    listContractsMock.mockResolvedValue({
      items: [
        {
          _id: 'contract-1',
          status: 'active',
          property: { title: 'Piso Centro' },
        },
        {
          _id: 'contract-2',
          status: 'draft',
        },
      ],
    });
  });

  it('renders tenant summary from existing APIs', async () => {
    render(
      <MemoryRouter>
        <TenantHome />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument();
    expect(await screen.findByText('Piso Centro')).toBeInTheDocument();
    expect(screen.getByText('Tenant PRO')).toBeInTheDocument();
    expect(screen.getByText('Verificado')).toBeInTheDocument();
    expect(screen.getByText('Viviendas guardadas')).toBeInTheDocument();
  });
});
