import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PropertiesList, { hasActiveFilters, listingCountLabel } from '../PropertiesList';

const { searchMock, listFavMock, favMock, unfavMock, pushMock, auth } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  listFavMock: vi.fn(),
  favMock: vi.fn(),
  unfavMock: vi.fn(),
  pushMock: vi.fn(),
  auth: { user: { _id: 'tenant-1', role: 'tenant', name: 'Ana' } as any },
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ token: 't', user: auth.user }) }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));
vi.mock('../../../components/LoginPrompt', () => ({ default: () => null }));
vi.mock('../../../components/ui/Drawer', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));
vi.mock('../../../services/properties', () => ({
  searchProperties: searchMock,
  listMyFavorites: listFavMock,
  favoriteProperty: favMock,
  unfavoriteProperty: unfavMock,
}));

const property = (id: string, title: string) => ({ _id: id, title, city: 'Madrid', price: 1200, rooms: 2, images: [], status: 'active' });

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const renderPage = (url = '/properties') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <PropertiesList />
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('PropertiesList', () => {
  beforeEach(() => {
    auth.user = { _id: 'tenant-1', role: 'tenant', name: 'Ana' };
    searchMock.mockReset().mockResolvedValue({ items: [property('p1', 'Piso Chamberí')], total: 1, page: 1, limit: 12 });
    listFavMock.mockReset().mockResolvedValue({ items: [] });
    favMock.mockReset().mockResolvedValue({});
    unfavMock.mockReset().mockResolvedValue({});
    pushMock.mockReset();
  });

  it('labels the count and detects chosen filters', () => {
    expect(listingCountLabel(1)).toBe('1 vivienda disponible');
    expect(listingCountLabel(24)).toBe('24 viviendas disponibles');
    expect(hasActiveFilters({ sort: 'price', dir: 'asc', page: 2, limit: 12 })).toBe(false);
    expect(hasActiveFilters({ city: 'Madrid' })).toBe(true);
    expect(hasActiveFilters({ furnished: false, q: '' })).toBe(false);
  });

  it('shows the listings with their count', async () => {
    renderPage();
    expect(await screen.findByText('Piso Chamberí')).toBeInTheDocument();
    expect(screen.getByText('1 vivienda disponible')).toBeInTheDocument();
  });

  it('clears every filter from the empty state', async () => {
    searchMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });
    renderPage('/properties?city=Soria&priceMax=300&page=1');
    await screen.findByText('No hay viviendas con esos filtros');
    fireEvent.click(screen.getByText('Borrar filtros', { selector: 'button' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(screen.getByPlaceholderText('Ciudad / Zona')).toHaveValue('');
  });

  it('clears the filters from the filter bar too', async () => {
    renderPage('/properties?city=Soria');
    await screen.findByText('Piso Chamberí');
    expect(screen.getByPlaceholderText('Ciudad / Zona')).toHaveValue('Soria');
    fireEvent.click(screen.getByTitle('Borrar filtros'));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(screen.getByPlaceholderText('Ciudad / Zona')).toHaveValue('');
  });

  it('says there are no listings yet when nothing is filtered', async () => {
    searchMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });
    renderPage();
    expect(await screen.findByText('Todavía no hay viviendas publicadas')).toBeInTheDocument();
    expect(screen.queryByText('No hay viviendas con esos filtros')).not.toBeInTheDocument();
  });

  it('explains a load error in Spanish and retries', async () => {
    searchMock.mockRejectedValueOnce(new Error('Request failed with status code 500'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el listado');
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Piso Chamberí')).toBeInTheDocument();
  });

  it('undoes the heart and warns when saving fails', async () => {
    favMock.mockRejectedValue(new Error('boom'));
    renderPage();
    await screen.findByText('Piso Chamberí');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith({ title: 'No se pudo actualizar tus guardados', tone: 'error' }));
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('can unsave a listing that was saved', async () => {
    listFavMock.mockResolvedValue({ items: [{ _id: 'p1' }] });
    renderPage();
    const heart = await screen.findByRole('button', { name: 'Quitar de guardados' });
    fireEvent.click(heart);
    await waitFor(() => expect(unfavMock).toHaveBeenCalledWith('p1'));
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('aria-pressed', 'false');
  });
});
