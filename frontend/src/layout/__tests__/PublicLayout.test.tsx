import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicLayout from '../PublicLayout';
import { roleHome } from '../../utils/roleHome';

const auth = vi.hoisted(() => ({ user: null as null | { role: string } }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: auth.user }),
}));

vi.mock('../../components/PublicFooter', () => ({ default: () => null }));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/legal']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/legal" element={<p>Página legal</p>} />
          <Route path="/properties" element={<p>Listado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicLayout', () => {
  beforeEach(() => {
    auth.user = null;
  });

  it('sin sesión ofrece «Entrar» y «Crear cuenta»', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'Crear cuenta' })[0]).toHaveAttribute('href', '/register');
  });

  it('el menú abre los enlaces, se cierra al navegar y con Escape', () => {
    renderLayout();
    const button = screen.getByRole('button', { name: 'Abrir menú' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Menú' })).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('navigation', { name: 'Menú' });
    fireEvent.click(menu.querySelector('a[href="/properties"]')!);
    expect(screen.getByText('Listado')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Menú' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Menú' })).toBeNull();
  });

  it('«Mi cuenta» lleva al inicio de cada rol', () => {
    auth.user = { role: 'landlord' };
    renderLayout();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/landlord');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });
});

describe('roleHome', () => {
  it('da el inicio de cada rol y el respaldo si no lo conoce', () => {
    expect(roleHome('tenant')).toBe('/tenant');
    expect(roleHome('agency')).toBe('/agency');
    expect(roleHome('admin')).toBe('/admin');
    expect(roleHome(undefined)).toBe('/');
    expect(roleHome('otro', '/properties')).toBe('/properties');
  });
});
