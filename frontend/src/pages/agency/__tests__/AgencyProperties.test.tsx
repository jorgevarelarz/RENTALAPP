import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgencyProperties from '../AgencyProperties';

const { listMock, modalMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  modalMock: vi.fn(),
}));

vi.mock('../../../services/agency', () => ({ listAgencyProperties: listMock }));
vi.mock('../../../components/ApplicantsModal', () => ({
  default: (props: any) => {
    modalMock(props);
    return props.isOpen ? <div role="dialog">Candidatos de {props.property.title}</div> : null;
  },
}));

const managed = {
  id: 'p1',
  title: 'Piso en Santiago',
  address: 'Rúa do Vilar 1',
  city: 'Santiago de Compostela',
  status: 'active',
  ownerName: 'Paco Prop',
  agencyAccess: 'manage',
  hasActiveContract: false,
  price: 750,
  deposit: 750,
  openApplications: 2,
};
const transferred = {
  id: 'p2',
  title: 'Ático en Vigo',
  city: 'Vigo',
  status: 'active',
  agencyAccess: 'status_only',
  agencyTransferredAt: '2026-09-01T10:00:00Z',
  hasActiveContract: true,
};

const renderPage = () => render(<MemoryRouter><AgencyProperties /></MemoryRouter>);

describe('AgencyProperties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('separa los gestionados de los traspasados y abre los candidatos con precio y fianza', async () => {
    listMock.mockResolvedValue([managed, transferred]);
    renderPage();

    const managedSection = await screen.findByRole('region', { name: 'Gestionas 1 inmueble' });
    expect(within(managedSection).getByText('Piso en Santiago')).toBeInTheDocument();
    expect(within(managedSection).getByText(/Propietario: Paco Prop/)).toBeInTheDocument();
    expect(within(managedSection).getByText('2 solicitudes')).toBeInTheDocument();

    const transferredSection = screen.getByRole('region', { name: 'Traspasados al propietario' });
    expect(within(transferredSection).getByText('Ático en Vigo')).toBeInTheDocument();
    // Un inmueble traspasado no deja ver candidatos
    expect(within(transferredSection).queryByRole('button')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver candidatos de Piso en Santiago' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Candidatos de Piso en Santiago');
    expect(modalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ property: expect.objectContaining({ _id: 'p1', price: 750, deposit: 750 }) }),
    );
  });

  it('sin inmuebles lleva a dar de alta propietarios', async () => {
    listMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Todavía no gestionas ningún inmueble')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a propietarios' })).toHaveAttribute('href', '/agency/landlords');
  });

  it('si falla la carga lo dice y deja reintentar', async () => {
    listMock.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce([managed]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Piso en Santiago')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('el enlace del correo (?solicitudes=<id>) abre los candidatos de un inmueble gestionado, no de uno traspasado', async () => {
    listMock.mockResolvedValue([managed, transferred]);
    const { unmount } = render(
      <MemoryRouter initialEntries={['/agency/properties?solicitudes=p1']}><AgencyProperties /></MemoryRouter>,
    );
    expect(await screen.findByRole('dialog')).toHaveTextContent('Candidatos de Piso en Santiago');
    unmount();

    render(<MemoryRouter initialEntries={['/agency/properties?solicitudes=p2']}><AgencyProperties /></MemoryRouter>);
    expect(await screen.findByText('Ático en Vigo')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
