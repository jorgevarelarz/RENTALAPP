import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantApplications from '../Applications';

const { getMock, acceptMock, proposeMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  acceptMock: vi.fn(),
  proposeMock: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { _id: 'tenant-1', role: 'tenant', name: 'Ana' } }),
}));
vi.mock('../../../api/client', () => ({
  api: { get: getMock },
  formatApiError: (_e: unknown, fallback: string) => fallback,
}));
vi.mock('../../../services/appointments', () => ({
  acceptApplicationVisit: acceptMock,
  proposeApplicationVisit: proposeMock,
}));

const property = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  _id: id,
  title,
  address: 'Calle Mayor 1',
  city: 'Madrid',
  price: 1450,
  images: [],
  owner: { _id: `owner-${id}`, name: 'Luis' },
  ...extra,
});

const items = [
  {
    _id: 'a-proposed',
    status: 'proposed',
    proposedBy: 'landlord',
    proposedDate: '2030-03-12T09:00:00.000Z',
    message: 'Somos dos y trabajamos en Madrid.',
    property: property('p1', 'Piso en Chamberí'),
  },
  {
    _id: 'a-pending',
    status: 'pending',
    property: property('p2', 'Ático en Retiro'),
  },
  {
    _id: 'a-expired',
    status: 'proposed',
    proposedBy: 'landlord',
    proposedDate: '2020-01-10T09:00:00.000Z',
    property: property('p3', 'Estudio en Lavapiés'),
  },
  {
    _id: 'a-scheduled',
    status: 'scheduled',
    visitDate: '2030-03-20T16:30:00.000Z',
    contractId: 'c1',
    contractStatus: 'pending_signature',
    property: property('p4', 'Piso en Malasaña'),
  },
  {
    _id: 'a-rejected',
    status: 'rejected',
    property: property('p5', 'Dúplex en Salamanca'),
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <TenantApplications />
    </MemoryRouter>,
  );

const rowOf = async (title: string) => (await screen.findByText(title)).closest('li') as HTMLElement;

describe('Mis solicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { items } });
  });

  it('enseña cada solicitud con su estado en español, el precio y tu mensaje', async () => {
    renderPage();
    const proposed = await rowOf('Piso en Chamberí');
    expect(proposed).toHaveTextContent('1450 €');
    expect(proposed).toHaveTextContent(/El propietario te propone visitarlo el martes, 12 de marzo a las \d{2}:00/);
    expect(proposed).toHaveTextContent('Tu mensaje');
    expect(proposed).toHaveTextContent('Somos dos y trabajamos en Madrid.');
    expect(within(proposed).getByRole('button', { name: 'Aceptar visita' })).toBeInTheDocument();
    expect(within(proposed).getByRole('link', { name: 'Escribir al propietario' })).toHaveAttribute('href', '/inbox/owner-p1');

    const pending = await rowOf('Ático en Retiro');
    expect(pending).toHaveTextContent('Solicitud enviada. El propietario te propondrá una fecha.');
    expect(within(pending).queryByRole('button')).toBeNull();

    const scheduled = await rowOf('Piso en Malasaña');
    expect(scheduled).toHaveTextContent(/Visita concertada el miércoles, 20 de marzo/);
    expect(within(scheduled).getByRole('link', { name: 'Firmar contrato' })).toHaveAttribute('href', '/contracts/c1');

    const rejected = await rowOf('Dúplex en Salamanca');
    expect(rejected).toHaveTextContent('El propietario ha seguido con otros candidatos');
    expect(within(rejected).queryByRole('link', { name: 'Escribir al propietario' })).toBeNull();
  });

  it('una propuesta caducada no se puede aceptar, solo proponer otra fecha', async () => {
    renderPage();
    const expired = await rowOf('Estudio en Lavapiés');
    expect(expired).toHaveTextContent('La fecha que te propusieron ya pasó. Propón otra.');
    expect(within(expired).queryByRole('button', { name: 'Aceptar visita' })).toBeNull();
    expect(within(expired).getByRole('button', { name: 'Proponer otra fecha' })).toBeInTheDocument();
  });

  it('aceptar la visita recarga la lista; si falla, explica por qué en la tarjeta', async () => {
    acceptMock.mockResolvedValueOnce({ ok: true });
    renderPage();
    const row = await rowOf('Piso en Chamberí');
    fireEvent.click(within(row).getByRole('button', { name: 'Aceptar visita' }));
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('a-proposed'));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));

    acceptMock.mockRejectedValueOnce({ response: { data: { error: 'proposed_date_passed' } } });
    fireEvent.click(within(await rowOf('Piso en Chamberí')).getByRole('button', { name: 'Aceptar visita' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha propuesta ya pasó. Propón otra.');
  });

  it('propone otra fecha mandando el instante en ISO (la hora local con su zona)', async () => {
    proposeMock.mockResolvedValueOnce({ ok: true });
    renderPage();
    const row = await rowOf('Piso en Chamberí');
    fireEvent.click(within(row).getByRole('button', { name: 'Proponer otra fecha' }));
    const input = within(row).getByLabelText('Día y hora que te viene bien');
    fireEvent.change(input, { target: { value: '2030-04-02T18:00' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Enviar propuesta' }));
    await waitFor(() =>
      expect(proposeMock).toHaveBeenCalledWith('a-proposed', new Date('2030-04-02T18:00').toISOString()),
    );
  });

  it('no manda una fecha pasada y muestra el error del servidor', async () => {
    renderPage();
    const row = await rowOf('Piso en Chamberí');
    fireEvent.click(within(row).getByRole('button', { name: 'Proponer otra fecha' }));
    fireEvent.change(within(row).getByLabelText('Día y hora que te viene bien'), { target: { value: '2020-04-02T18:00' } });
    fireEvent.submit(within(row).getByRole('button', { name: 'Enviar propuesta' }).closest('form')!);
    expect(await within(row).findByRole('alert')).toHaveTextContent('Esa fecha ya ha pasado');
    expect(proposeMock).not.toHaveBeenCalled();

    proposeMock.mockRejectedValueOnce({ response: { data: { error: 'application_closed' } } });
    fireEvent.change(within(row).getByLabelText('Día y hora que te viene bien'), { target: { value: '2030-04-02T18:00' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Enviar propuesta' }));
    await waitFor(() => expect(within(row).getByRole('alert')).toHaveTextContent('Esta solicitud ya está cerrada.'));
  });

  it('una visita concertada se puede cambiar; la concertada sigue en pie y la misma hora se explica', async () => {
    proposeMock.mockRejectedValueOnce({ response: { data: { error: 'same_visit_date' } } });
    proposeMock.mockResolvedValueOnce({ ok: true });
    renderPage();
    const row = await rowOf('Piso en Malasaña');
    fireEvent.click(within(row).getByRole('button', { name: 'Cambiar fecha' }));
    expect(row).toHaveTextContent(/sigue en pie la visita el miércoles, 20 de marzo/);
    fireEvent.change(within(row).getByLabelText('Nueva fecha para la visita'), { target: { value: '2030-03-20T17:30' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Proponer cambio' }));
    expect(await within(row).findByRole('alert')).toHaveTextContent('Esa es la hora que ya tenéis concertada');

    fireEvent.change(within(row).getByLabelText('Nueva fecha para la visita'), { target: { value: '2030-03-22T11:00' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Proponer cambio' }));
    await waitFor(() =>
      expect(proposeMock).toHaveBeenLastCalledWith('a-scheduled', new Date('2030-03-22T11:00').toISOString()),
    );
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
  });

  it('un cambio de fecha pendiente enseña las dos fechas; una visita ya pasada no se cambia', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            _id: 'a-change-landlord',
            status: 'proposed',
            proposedBy: 'landlord',
            proposedDate: '2030-03-22T09:00:00.000Z',
            visitDate: '2030-03-20T16:30:00.000Z',
            property: property('p6', 'Loft en Chueca'),
          },
          {
            _id: 'a-change-mine',
            status: 'proposed',
            proposedBy: 'tenant',
            proposedDate: '2030-03-22T09:00:00.000Z',
            visitDate: '2030-03-20T16:30:00.000Z',
            property: property('p7', 'Piso en Arganzuela'),
          },
          {
            _id: 'a-visited',
            status: 'scheduled',
            visitDate: '2020-03-20T16:30:00.000Z',
            property: property('p8', 'Bajo en Usera'),
          },
        ],
      },
    });
    renderPage();
    const fromLandlord = await rowOf('Loft en Chueca');
    expect(fromLandlord).toHaveTextContent(
      /El propietario propone cambiar la visita al viernes, 22 de marzo a las \d{2}:00\. Mientras no aceptes, sigue en pie la del miércoles, 20 de marzo/,
    );
    expect(within(fromLandlord).getByRole('button', { name: 'Aceptar visita' })).toBeInTheDocument();

    const mine = await rowOf('Piso en Arganzuela');
    expect(mine).toHaveTextContent(/Has pedido cambiar la visita al viernes, 22 de marzo.*sigue en pie la del miércoles, 20 de marzo/);
    expect(within(mine).queryByRole('button')).toBeNull();

    const visited = await rowOf('Bajo en Usera');
    expect(visited).toHaveTextContent('Visitaste el piso');
    expect(within(visited).queryByRole('button', { name: 'Cambiar fecha' })).toBeNull();
  });

  it('sin solicitudes invita a buscar pisos; si falla la carga lo dice', async () => {
    getMock.mockResolvedValueOnce({ data: { items: [] } });
    const { unmount } = renderPage();
    expect(await screen.findByText('Aún no has pedido ninguna visita')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar pisos' })).toHaveAttribute('href', '/properties');
    unmount();

    getMock.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText('No se pudieron cargar tus solicitudes')).toBeInTheDocument();
  });
});
