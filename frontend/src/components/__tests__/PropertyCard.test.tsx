import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PropertyCard from '../PropertyCard';

const base: any = {
  _id: 'p1',
  title: 'Piso luminoso en Malasaña',
  city: 'Madrid',
  region: 'madrid',
  price: 1450,
  rooms: 2,
  bathrooms: 1,
  sizeM2: 68,
  images: ['/uploads/a.jpg'],
};

const renderCard = (p: any, onFavToggle?: any) =>
  render(
    <MemoryRouter>
      <PropertyCard p={p} onFavToggle={onFavToggle} />
    </MemoryRouter>,
  );

describe('PropertyCard', () => {
  it('enseña precio en es-ES, ciudad y características en español', () => {
    renderCard(base);
    expect(screen.getByText(/1450\s€|1\.450\s€/)).toBeInTheDocument();
    expect(screen.getByText('Madrid')).toBeInTheDocument();
    expect(screen.getByText('2 habitaciones · 1 baño · 68 m²')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Piso luminoso en Malasaña' })).toHaveAttribute('href', '/properties/p1');
  });

  it('sin fotos no pide una imagen de relleno externa', () => {
    const { container } = renderCard({ ...base, images: [], rooms: 0 });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Sin fotos todavía')).toBeInTheDocument();
    expect(screen.getByText('Estudio · 1 baño · 68 m²')).toBeInTheDocument();
  });

  it('el corazón dice si está guardado y avisa al pulsarlo', () => {
    const onFav = vi.fn();
    renderCard({ ...base, _liked: true, onlyTenantPro: true }, onFav);
    const btn = screen.getByRole('button', { name: 'Quitar de guardados' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onFav).toHaveBeenCalledWith('p1', true);
    expect(screen.getByText('Solo Tenant PRO')).toBeInTheDocument();
  });
});
