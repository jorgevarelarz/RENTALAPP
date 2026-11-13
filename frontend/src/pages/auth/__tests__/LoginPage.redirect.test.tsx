import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../LoginPage';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('../../../components/SocialAuthButtons', () => ({ default: () => null }));

describe('LoginPage, vuelta tras crear cuenta', () => {
  it('llegando desde una ruta protegida, «Crea una gratis» conserva la vuelta', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/contracts/c1?deposit=success' } }]}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Crea una gratis' })).toHaveAttribute(
      'href',
      `/register?redirect=${encodeURIComponent('/contracts/c1?deposit=success')}`,
    );
  });

  it('sin origen, el enlace va al registro sin más', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Crea una gratis' })).toHaveAttribute('href', '/register');
  });
});
