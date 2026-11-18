import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProList from '../ProList';

const { listProsMock } = vi.hoisted(() => ({ listProsMock: vi.fn() }));
vi.mock('../../services/pro', () => ({ listPros: listProsMock }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ProList />
      </MemoryRouter>
    </QueryClientProvider>
  );

const PRO = {
  _id: 'p1', displayName: 'Reformas García', city: 'Madrid',
  services: [{ key: 'plumbing', basePrice: 45 }, { key: 'painting' }], ratingAvg: 0, reviewCount: 0,
};

describe('Directorio de profesionales', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista en español, filtra por servicio y ciudad en el servidor y enseña el precio del servicio elegido', async () => {
    listProsMock.mockResolvedValue({ items: [PRO], total: 1, page: 1, limit: 20 });
    renderPage();

    expect((await screen.findByText('Reformas García')).closest('a')).toHaveAttribute('href', '/pros/p1');
    expect(screen.getByText('Fontanería, Pintura')).toBeInTheDocument();
    // Sin opiniones no se enseña la valoración; sin servicio elegido, tampoco precio.
    expect(screen.getByText('Madrid')).toBeInTheDocument();
    expect(screen.queryByText(/desde/)).toBeNull();
    expect(listProsMock).toHaveBeenLastCalledWith({ service: undefined, city: undefined, page: 1, limit: 20 });

    await userEvent.click(screen.getByRole('button', { name: 'Fontanería' }));
    expect(await screen.findByText(/desde 45,00/)).toBeInTheDocument();
    expect(listProsMock).toHaveBeenLastCalledWith({ service: 'plumbing', city: undefined, page: 1, limit: 20 });

    await userEvent.type(screen.getByPlaceholderText('Ciudad'), ' Madrid ');
    await waitFor(() => expect(listProsMock).toHaveBeenLastCalledWith({ service: 'plumbing', city: 'Madrid', page: 1, limit: 20 }));
  });

  it('sin resultados con filtros ofrece quitarlos', async () => {
    listProsMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    renderPage();
    expect(await screen.findByText('Todavía no hay profesionales en el directorio.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));
    expect(await screen.findByText('Nadie coincide con estos filtros.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true'));
  });
});
