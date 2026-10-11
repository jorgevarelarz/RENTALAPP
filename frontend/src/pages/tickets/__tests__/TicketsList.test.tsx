import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TicketsList from '../TicketsList';

const { listMyTicketsMock } = vi.hoisted(() => ({ listMyTicketsMock: vi.fn() }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'token-1', user: { _id: 'owner-1', role: 'landlord', name: 'Luis' } }),
}));
vi.mock('../../../services/tickets', () => ({ listMyTickets: listMyTicketsMock }));

const renderList = (path = '/tickets') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <TicketsList />
      </MemoryRouter>
    </QueryClientProvider>
  );

const ticket = (id: string, title: string, service = 'plumbing') => ({ _id: id, title, service, status: 'open', createdAt: '2026-10-01T09:00:00Z' });

describe('Incidencias: listado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyTicketsMock.mockImplementation(async (_role: string, params: any) =>
      params.q
        ? { items: [ticket('t9', 'Grifo del baño')], total: 1, page: 1 }
        : { items: [ticket('t1', 'Persiana rota', 'others')], total: 45, page: params.page || 1 }
    );
  });

  it('manda la búsqueda al servidor, vuelve a la primera página y enseña lo que devuelve', async () => {
    renderList('/tickets?page=2');
    expect(await screen.findByText('Persiana rota')).toBeInTheDocument();
    expect(listMyTicketsMock).toHaveBeenLastCalledWith('landlord', expect.objectContaining({ page: 2, q: undefined }));

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar incidencias' }), { target: { value: '  grifo ' } });
    expect(await screen.findByText('Grifo del baño')).toBeInTheDocument();
    expect(listMyTicketsMock).toHaveBeenLastCalledWith('landlord', expect.objectContaining({ page: 1, q: 'grifo' }));
    // Un solo resultado: sin paginación.
    expect(screen.queryByText(/Página \d+ de/)).toBeNull();
  });

  it('dice que nada coincide cuando la búsqueda no encuentra incidencias', async () => {
    listMyTicketsMock.mockImplementation(async (_role: string, params: any) =>
      params.q ? { items: [], total: 0, page: 1 } : { items: [ticket('t1', 'Persiana rota')], total: 1, page: 1 }
    );
    renderList();
    await screen.findByText('Persiana rota');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar incidencias' }), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('Ninguna incidencia coincide con la búsqueda.')).toBeInTheDocument());
    // El buscador sigue a la vista para corregir la búsqueda.
    expect(screen.getByRole('searchbox', { name: 'Buscar incidencias' })).toHaveValue('zzz');
  });
});
