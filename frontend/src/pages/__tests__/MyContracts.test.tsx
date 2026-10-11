import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyContracts from '../MyContracts';

const { listContractsMock, listInvitesMock, auth } = vi.hoisted(() => ({
  listContractsMock: vi.fn(),
  listInvitesMock: vi.fn(),
  auth: { user: { _id: 'u1', email: 'ana@example.com', role: 'tenant' } },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: auth.user }),
}));

vi.mock('../../services/contracts', () => ({ listContracts: listContractsMock }));
vi.mock('../../services/coTenants', () => ({ listMyCoTenantInvites: listInvitesMock }));

const contracts = [
  {
    _id: 'c1',
    status: 'active',
    rent: 950,
    deposit: 950,
    depositPaid: true,
    tenantId: 'u1',
    ownerId: 'l1',
    myRole: 'tenant',
    landlordName: 'Luis Gómez',
    property: { _id: 'p1', title: 'Piso Centro', address: 'Calle Mayor 1', city: 'Madrid' },
  },
  {
    _id: 'c2',
    status: 'signed',
    rent: 1200,
    deposit: 1200,
    depositPaid: false,
    tenantId: 'u9',
    ownerId: 'l2',
    myRole: 'cotenant',
    landlordName: 'Marta Ruiz',
    property: { _id: 'p2', title: 'Ático Retiro', city: 'Madrid' },
  },
  {
    _id: 'c3',
    status: 'pending_signature',
    rent: 700,
    deposit: 700,
    tenantId: 'u1',
    ownerId: 'l3',
    property: { _id: 'p3', title: 'Estudio Lavapiés' },
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <MyContracts />
    </MemoryRouter>,
  );
}

describe('MyContracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { _id: 'u1', email: 'ana@example.com', role: 'tenant' };
    listContractsMock.mockResolvedValue({ items: contracts });
    listInvitesMock.mockResolvedValue([]);
  });

  it('pide también los contratos de co-titular y los marca', async () => {
    renderPage();
    expect(await screen.findByText('Piso Centro')).toBeInTheDocument();
    expect(listContractsMock).toHaveBeenCalledWith('t', { include: 'cotenant' });
    const shared = screen.getByText('Ático Retiro').closest('a')!;
    expect(shared).toHaveAttribute('href', '/contracts/c2');
    expect(within(shared).getByText('Co-titular')).toBeInTheDocument();
    expect(within(shared).getByText(/El inquilino principal confirma la fianza/)).toBeInTheDocument();
    expect(screen.getByText('950,00 €/mes')).toBeInTheDocument();
    expect(screen.getByText('Arrendador: Luis Gómez')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it('la agencia gestora ve propietario e inquilino y el siguiente paso que le toca', async () => {
    auth.user = { _id: 'a1', email: 'agencia@example.com', role: 'agency' };
    listContractsMock.mockResolvedValue({
      items: [
        {
          _id: 'c7',
          status: 'draft',
          rent: 800,
          tenantId: 'u1',
          ownerId: 'l1',
          landlordName: 'Luis Gómez',
          tenantName: 'Ana Pérez',
          property: { _id: 'p7', title: 'Piso Ensanche', city: 'Valencia' },
        },
      ],
    });
    renderPage();
    const row = (await screen.findByText('Piso Ensanche')).closest('a')!;
    expect(row).toHaveAttribute('href', '/contracts/c7');
    expect(within(row).getByText('Propietario: Luis Gómez · Inquilino: Ana Pérez')).toBeInTheDocument();
    expect(within(row).getByText(/Revisar los datos con el propietario/)).toBeInTheDocument();
    expect(screen.getByText(/inmuebles que gestionas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver inmuebles' })).toHaveAttribute('href', '/agency/properties');
    expect(listInvitesMock).not.toHaveBeenCalled();
  });

  it('filtra por grupo de estado con su recuento', async () => {
    renderPage();
    await screen.findByText('Piso Centro');
    fireEvent.click(screen.getByRole('button', { name: /En trámite/ }));
    expect(screen.getByRole('button', { name: /En trámite/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Estudio Lavapiés')).toBeInTheDocument();
    expect(screen.queryByText('Piso Centro')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cerrados/ }));
    expect(screen.getByText('No hay contratos en este estado.')).toBeInTheDocument();
  });

  it('muestra las invitaciones pendientes y que se aceptan desde el correo', async () => {
    listInvitesMock.mockResolvedValue([
      {
        partyId: 'i1',
        contractId: 'c7',
        email: 'ana@example.com',
        expired: false,
        expiresAt: '2026-10-13T10:00:00.000Z',
        landlordName: 'Pedro Sanz',
        property: { id: 'p7', title: 'Piso en Chamberí', address: 'Calle Luchana 12', city: 'Madrid' },
      },
      { partyId: 'i2', contractId: 'c8', email: 'ana@example.com', expired: true, property: { id: 'p8', title: 'Loft Malasaña' } },
    ]);
    renderPage();
    expect(await screen.findByText('Invitaciones pendientes')).toBeInTheDocument();
    expect(screen.getByText('Calle Luchana 12, Madrid')).toBeInTheDocument();
    expect(screen.getByText('Acepta desde el enlace que enviamos a ana@example.com.')).toBeInTheDocument();
    expect(screen.getByText('Caduca el 13/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Caducada')).toBeInTheDocument();
  });

  it('sin contratos ni invitaciones ofrece buscar pisos; el casero no pide invitaciones', async () => {
    listContractsMock.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Aún no tienes contratos')).toBeInTheDocument();
    expect(screen.queryByText('Invitaciones pendientes')).not.toBeInTheDocument();

    vi.clearAllMocks();
    auth.user = { _id: 'l1', email: 'luis@example.com', role: 'landlord' };
    listContractsMock.mockResolvedValue({ items: contracts });
    renderPage();
    expect(await screen.findAllByText('Piso Centro')).not.toHaveLength(0);
    expect(listInvitesMock).not.toHaveBeenCalled();
  });

  it('si fallan las invitaciones, la lista se muestra igual', async () => {
    listInvitesMock.mockRejectedValue(new Error('403'));
    renderPage();
    expect(await screen.findByText('Piso Centro')).toBeInTheDocument();
    expect(screen.queryByText('Invitaciones pendientes')).not.toBeInTheDocument();
  });
});
