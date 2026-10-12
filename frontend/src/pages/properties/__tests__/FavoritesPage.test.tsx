import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FavoritesPage, { savedCountLabel } from '../FavoritesPage';

const { listMock, favMock, unfavMock, user } = vi.hoisted(() => ({
  listMock: vi.fn(),
  favMock: vi.fn(),
  unfavMock: vi.fn(),
  user: { _id: 'tenant-1', role: 'tenant', name: 'Ana' },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user }),
}));
vi.mock('../../../api/client', () => ({
  formatApiError: (_e: unknown, fallback: string) => fallback,
}));
vi.mock('../../../services/properties', () => ({
  listMyFavorites: listMock,
  favoriteProperty: favMock,
  unfavoriteProperty: unfavMock,
}));

const property = (id: string, title: string) => ({
  _id: id,
  title,
  city: 'Madrid',
  price: 1200,
  rooms: 2,
  images: [],
  status: 'active',
  _liked: true,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <FavoritesPage />
    </MemoryRouter>,
  );

describe('FavoritesPage', () => {
  beforeEach(() => {
    listMock.mockReset();
    favMock.mockReset().mockResolvedValue({});
    unfavMock.mockReset().mockResolvedValue({});
    listMock.mockResolvedValue({ items: [property('p1', 'Piso Chamberí'), property('p2', 'Ático Retiro')] });
  });

  it('counts saved listings in Spanish', () => {
    expect(savedCountLabel(1)).toBe('1 piso guardado');
    expect(savedCountLabel(3)).toBe('3 pisos guardados');
  });

  it('lists the saved listings with their count', async () => {
    renderPage();
    expect(await screen.findByText('Piso Chamberí')).toBeInTheDocument();
    expect(screen.getByText('Ático Retiro')).toBeInTheDocument();
    expect(screen.getByText('2 pisos guardados')).toBeInTheDocument();
  });

  it('removes a listing and lets the user undo it', async () => {
    renderPage();
    await screen.findByText('Piso Chamberí');
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar de guardados' })[0]);

    await waitFor(() => expect(unfavMock).toHaveBeenCalledWith('p1'));
    expect(await screen.findByRole('status')).toHaveTextContent('Has quitado «Piso Chamberí» de favoritos.');
    expect(screen.queryByText('Piso Chamberí', { selector: 'a' })).not.toBeInTheDocument();
    expect(screen.getByText('1 piso guardado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(favMock).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText('Piso Chamberí', { selector: 'a' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('2 pisos guardados')).toBeInTheDocument();
  });

  it('puts the listing back and explains when removing fails', async () => {
    unfavMock.mockRejectedValue(new Error('network'));
    renderPage();
    await screen.findByText('Piso Chamberí');
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar de guardados' })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo quitar de favoritos');
    expect(screen.getByText('Piso Chamberí', { selector: 'a' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a load error with retry instead of an empty list', async () => {
    listMock.mockRejectedValueOnce(new Error('network'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus favoritos');
    expect(screen.queryByText('Aún no has guardado ningún piso')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Piso Chamberí')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers to search when nothing is saved', async () => {
    listMock.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Aún no has guardado ningún piso')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Buscar pisos' })).toHaveLength(1);
  });
});
