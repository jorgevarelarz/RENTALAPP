import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyDetail from '../properties/PropertyDetail';

const mocks = vi.hoisted(() => ({
  getProperty: vi.fn(),
  applyToProperty: vi.fn(),
  favoriteProperty: vi.fn(),
  unfavoriteProperty: vi.fn(),
  incrementView: vi.fn(),
  getTenantProInfo: vi.fn(),
  push: vi.fn(),
  user: null as null | { _id: string; role: string },
}));

vi.mock('../../services/properties', () => ({
  getProperty: mocks.getProperty,
  applyToProperty: mocks.applyToProperty,
  favoriteProperty: mocks.favoriteProperty,
  unfavoriteProperty: mocks.unfavoriteProperty,
  incrementView: mocks.incrementView,
}));
vi.mock('../../services/tenantPro', () => ({ getTenantProInfo: mocks.getTenantProInfo }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: mocks.push }) }));
vi.mock('../../components/TenantProPanel', () => ({ default: () => <div>Panel Tenant PRO</div> }));

const PROPERTY = {
  _id: 'p1',
  title: 'Piso luminoso en Malasaña',
  address: 'C/ Pez 3',
  city: 'Madrid',
  region: 'madrid',
  price: 1200,
  deposit: 1200,
  rooms: 2,
  bathrooms: 1,
  sizeM2: 60,
  furnished: true,
  petsAllowed: false,
  availableFrom: '2099-11-01T00:00:00.000Z',
  images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg', '/uploads/d.jpg'],
  location: { type: 'Point', coordinates: [-3.705, 40.424] },
  status: 'active',
  _mine: false,
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/properties/p1']}>
        <Routes>
          <Route path="/properties/:id" element={<PropertyDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

/** La tarjeta del precio; la barra de móvil repite precio y estado. */
const card = () => within(screen.getByRole('complementary'));

describe('Ficha del anuncio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
  });

  it('enseña los datos en español y al anónimo le pide iniciar sesión para solicitar visita', async () => {
    mocks.getProperty.mockResolvedValue(PROPERTY);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Piso luminoso en Malasaña' })).toBeInTheDocument();
    expect(screen.getByText('2 habitaciones · 1 baño · 60 m²')).toBeInTheDocument();
    expect(card().getByText('/mes').parentElement?.textContent).toMatch(/^1\.?200\s?€\/mes$/);
    expect(screen.getByText(/Fianza: 1 mes/)).toBeInTheDocument();
    expect(screen.getByText('Disponible desde el 1 de noviembre de 2099')).toBeInTheDocument();
    expect(screen.getByText('No admite mascotas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir en Google Maps' })).toHaveAttribute('target', '_blank');
    expect(mocks.incrementView).toHaveBeenCalledWith('p1');

    await userEvent.click(screen.getAllByRole('button', { name: 'Solicitar visita' })[0]);
    expect(mocks.applyToProperty).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Inicia sesión' })).toBeInTheDocument();
  });

  it('la galería no repite fotos y el visor pasa de una a otra', async () => {
    mocks.getProperty.mockResolvedValue(PROPERTY);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Ver las 4 fotos' }));
    const viewer = screen.getByRole('dialog', { name: 'Fotos de Piso luminoso en Malasaña' });
    expect(within(viewer).getByText('1 de 4')).toBeInTheDocument();
    await userEvent.click(within(viewer).getByRole('button', { name: 'Foto anterior' }));
    expect(within(viewer).getByText('4 de 4')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(viewer).getByText('1 de 4')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('el inquilino solicita la visita y ve que está enviada; guardar se marca', async () => {
    mocks.user = { _id: 't1', role: 'tenant' };
    mocks.getProperty.mockResolvedValue({ ...PROPERTY, _liked: false });
    mocks.applyToProperty.mockResolvedValue({ ok: true });
    mocks.favoriteProperty.mockResolvedValue({ ok: true });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(mocks.favoriteProperty).toHaveBeenCalledWith('p1');
    expect(await screen.findByRole('button', { name: 'Guardado' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getAllByRole('button', { name: 'Solicitar visita' })[0]);
    expect(mocks.applyToProperty).toHaveBeenCalledWith('p1');
    expect(await card().findByText('Solicitud enviada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mis solicitudes' })).toHaveAttribute('href', '/tenant/applications');
    expect(screen.queryByRole('button', { name: 'Solicitar visita' })).toBeNull();
  });

  it('si ya tiene visita concertada lo dice en lugar del botón', async () => {
    mocks.user = { _id: 't1', role: 'tenant' };
    mocks.getProperty.mockResolvedValue({
      ...PROPERTY,
      _application: { status: 'scheduled', visitDate: '2099-11-03T17:30:00.000Z' },
    });
    renderPage();
    await screen.findByRole('complementary');
    expect(card().getByText('Visita concertada')).toBeInTheDocument();
    expect(screen.getByText(/3 de noviembre de 2099/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar visita' })).toBeNull();
  });

  it('con Tenant PRO obligatorio y sin verificar no deja solicitar y enlaza a verificarse', async () => {
    mocks.user = { _id: 't1', role: 'tenant' };
    mocks.getProperty.mockResolvedValue({ ...PROPERTY, onlyTenantPro: true, requiredTenantProMaxRent: 1400 });
    mocks.getTenantProInfo.mockResolvedValue({ status: 'none' });
    renderPage();

    expect(await screen.findByText('Solo inquilinos con Tenant PRO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar visita' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Verificar mi solvencia' })).toHaveAttribute('href', '/tenant-pro');
    expect(screen.getByText(/4000\s?€|4\.000\s?€/)).toBeInTheDocument();
  });

  it('el propietario ve que es su anuncio, sin guardar ni solicitar', async () => {
    mocks.user = { _id: 'o1', role: 'landlord' };
    mocks.getProperty.mockResolvedValue({ ...PROPERTY, _mine: true, viewsCount: 12 });
    renderPage();

    await screen.findByRole('complementary');
    expect(card().getByText('Es tu anuncio')).toBeInTheDocument();
    expect(screen.getByText('Publicado · 12 visitas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gestionar inmuebles' })).toHaveAttribute('href', '/owner/properties');
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Solicitar visita' })).toBeNull();
  });

  it('un anuncio que no existe o ya no está publicado lo dice, sin esqueleto infinito', async () => {
    mocks.getProperty.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText('Este anuncio ya no está disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver otras viviendas' })).toHaveAttribute('href', '/properties');
  });

  it('sin fotos no inventa una imagen de relleno', async () => {
    mocks.getProperty.mockResolvedValue({ ...PROPERTY, images: [] });
    renderPage();
    expect(await screen.findByText('Este anuncio todavía no tiene fotos')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
