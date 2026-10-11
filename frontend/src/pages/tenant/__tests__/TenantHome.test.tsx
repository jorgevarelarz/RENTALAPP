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
          rent: 950,
          deposit: 1900,
          depositPaid: false,
          property: { title: 'Piso Centro', address: 'Calle Mayor 1', city: 'Madrid' },
        },
        {
          _id: 'contract-2',
          status: 'pending_signature',
          property: { title: 'Ático Retiro' },
        },
        {
          _id: 'contract-3',
          status: 'generated',
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

  it('shows the active rental with es-ES amounts and counts every in-progress status', async () => {
    render(
      <MemoryRouter>
        <TenantHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText('950,00 €/mes')).toBeInTheDocument();
    expect(screen.getByText('1900,00 € pendiente')).toBeInTheDocument();
    expect(screen.getByText('Calle Mayor 1, Madrid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pagar fianza' })).toHaveAttribute('href', '/contracts/contract-1');
    expect(screen.getByText('Ático Retiro')).toBeInTheDocument();
    expect(screen.getByText('Contratos en trámite', { selector: 'p' }).parentElement).toHaveTextContent('2');
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it('offers to search when there is no active rental', async () => {
    listContractsMock.mockResolvedValue({ items: [] });
    render(
      <MemoryRouter>
        <TenantHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Aún no tienes un alquiler activo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis solicitudes' })).toHaveAttribute('href', '/tenant/applications');
    expect(screen.queryByRole('link', { name: 'Pagar fianza' })).not.toBeInTheDocument();
  });
});
