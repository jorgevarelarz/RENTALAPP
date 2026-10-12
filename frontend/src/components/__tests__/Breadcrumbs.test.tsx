import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Breadcrumbs from '../Breadcrumbs';
import * as Auth from '../../context/AuthContext';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Breadcrumbs />
    </MemoryRouter>,
  );

describe('Breadcrumbs', () => {
  it('las fichas se nombran sin el ID interno', () => {
    at('/contracts/66f1a2b3c4d5e6f7a8b9c0d1');
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toHaveTextContent('Contrato');
    expect(nav).not.toHaveTextContent(/B9C0D1|#/i);
  });

  it('distingue el contrato firmado, la incidencia y el inmueble', () => {
    const { unmount } = at('/contracts/66f1a2b3c4d5e6f7a8b9c0d1/signed');
    expect(screen.getByText('Contrato firmado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contrato' })).toHaveAttribute('href', '/contracts/66f1a2b3c4d5e6f7a8b9c0d1');
    unmount();
    at('/tickets/66f1a2b3c4d5e6f7a8b9c0d1').unmount();
    at('/properties/66f1a2b3c4d5e6f7a8b9c0d1');
    expect(screen.getByText('Inmueble')).toBeInTheDocument();
  });

  it('nombra la ficha de un profesional', () => {
    at('/pros/66f1a2b3c4d5e6f7a8b9c0d1');
    expect(screen.getByText('Profesionales')).toBeInTheDocument();
    expect(screen.getByText('Profesional')).toBeInTheDocument();
  });

  describe('ficha de una incidencia según el rol', () => {
    afterEach(() => vi.restoreAllMocks());
    const asRole = (role: string) => vi.spyOn(Auth, 'useAuth').mockReturnValue({ user: { role } } as any);

    it('el casero vuelve a las incidencias de sus propiedades', () => {
      asRole('landlord');
      at('/tickets/66f1a2b3c4d5e6f7a8b9c0d1');
      expect(screen.getByRole('link', { name: 'Incidencias de mis propiedades' })).toHaveAttribute('href', '/landlord/issues');
      expect(screen.getByText('Incidencia')).toBeInTheDocument();
    });

    it('el profesional vuelve a las asignadas y el inquilino a las suyas', () => {
      const spy = asRole('pro');
      const { unmount } = at('/tickets/66f1a2b3c4d5e6f7a8b9c0d1');
      expect(screen.getByRole('link', { name: 'Incidencias asignadas' })).toHaveAttribute('href', '/pro/tickets');
      unmount();
      spy.mockReturnValue({ user: { role: 'tenant' } } as any);
      at('/tickets/66f1a2b3c4d5e6f7a8b9c0d1');
      expect(screen.getByRole('link', { name: 'Mis incidencias' })).toHaveAttribute('href', '/tickets');
    });
  });
});
