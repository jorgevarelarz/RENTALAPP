import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantHome from '../TenantHome';

const { listContractsMock, listMyFavoritesMock } = vi.hoisted(() => ({
  listContractsMock: vi.fn(),
  listMyFavoritesMock: vi.fn(),
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

vi.mock('../../../services/properties', () => ({
  listMyFavorites: listMyFavoritesMock,
}));

describe('TenantHome', () => {
  beforeEach(() => {
    listMyFavoritesMock.mockResolvedValue({ items: [{ _id: 'p1' }, { _id: 'p2' }] });
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

  it('asks for co-tenant contracts and does not offer the deposit payment to a co-tenant', async () => {
    listContractsMock.mockResolvedValue({
      items: [
        {
          _id: 'contract-9',
          status: 'signed',
          rent: 800,
          deposit: 800,
          depositPaid: false,
          myRole: 'cotenant',
          property: { title: 'Piso compartido' },
        },
      ],
    });
    render(
      <MemoryRouter>
        <TenantHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Piso compartido')).toBeInTheDocument();
    expect(listContractsMock).toHaveBeenCalledWith('token-1', { include: 'cotenant' });
    expect(screen.getByText('800,00 € pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pagar fianza' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver contrato' })).toHaveAttribute('href', '/contracts/contract-9');
  });

  it('counts the favorites saved on the server', async () => {
    render(
      <MemoryRouter>
        <TenantHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Piso Centro')).toBeInTheDocument();
    expect(screen.getByText('Favoritos', { selector: 'p' }).parentElement).toHaveTextContent('2');
  });

  it('keeps the contracts when the favorites cannot be loaded and shows no made-up count', async () => {
    listMyFavoritesMock.mockRejectedValue(new Error('network'));
    render(
      <MemoryRouter>
        <TenantHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Piso Centro')).toBeInTheDocument();
    expect(screen.getByText('Favoritos', { selector: 'p' }).parentElement).toHaveTextContent('–');
    expect(screen.queryByText(/No se pudo cargar/)).not.toBeInTheDocument();
  });
});
