import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="search">{useLocation().search}</output>
      <button type="button" onClick={() => navigate(-1)}>Atrás</button>
    </>
  );
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
    // El primero es el de la barra; el último, el del vacío
    const buttons = screen.getAllByRole('button', { name: 'Borrar filtros' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(screen.getByLabelText('Ciudad')).toHaveValue('');
  });

  it('clears the filters from the filter bar too', async () => {
    renderPage('/properties?city=Soria');
    await screen.findByText('Piso Chamberí');
    expect(screen.getByLabelText('Ciudad')).toHaveValue('Soria');
    fireEvent.click(within(screen.getByRole('search')).getByRole('button', { name: 'Borrar filtros' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(screen.getByLabelText('Ciudad')).toHaveValue('');
  });

  it('searches with Enter and leaves one history entry per search', async () => {
    renderPage('/properties?city=Soria');
    await screen.findByText('Piso Chamberí');
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Madrid' } });
    fireEvent.change(screen.getByLabelText('Habitaciones'), { target: { value: '2' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toContain('city=Madrid'));
    expect(screen.getByTestId('search').textContent).toContain('roomsMin=2');
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?city=Soria'));
    expect(screen.getByLabelText('Ciudad')).toHaveValue('Soria');
  });

  it('turning a toggle off stops filtering instead of asking for false', async () => {
    renderPage('/properties?furnished=true&petsAllowed=true');
    await screen.findByText('Piso Chamberí');
    const furnished = screen.getByRole('button', { name: 'Amueblado' });
    expect(furnished).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(furnished);
    // Hay dos: el de escritorio y el de móvil (uno de los dos oculto con CSS)
    fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
    await waitFor(() => expect(screen.getByTestId('search').textContent).toContain('petsAllowed=true'));
    expect(screen.getByTestId('search').textContent).not.toContain('furnished');
    expect(searchMock).toHaveBeenLastCalledWith(expect.not.objectContaining({ furnished: false }));
  });

  it('sorts by most viewed with the field the backend knows', async () => {
    renderPage();
    await screen.findByText('Piso Chamberí');
    fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: 'viewsCount-desc' } });
    // Hay dos: el de escritorio y el de móvil (uno de los dos oculto con CSS)
    fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
    await waitFor(() => expect(screen.getByTestId('search').textContent).toContain('sort=viewsCount'));
    expect(screen.getByLabelText('Ordenar')).toHaveValue('viewsCount-desc');
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
