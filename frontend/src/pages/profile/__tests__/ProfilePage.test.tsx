import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProfile, push, auth } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  push: vi.fn(),
  auth: { user: null as any },
}));
vi.mock('../../../services/user', () => ({ userService: { getProfile, updateProfile: vi.fn(), uploadAvatar: vi.fn() } }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../ChangePasswordCard', () => ({ default: () => null }));

import ProfilePage from '../ProfilePage';

const base = { id: 'u1', name: 'Lucía Pérez', email: 'lucia@test.com', role: 'tenant' };

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );

describe('ProfilePage', () => {
  beforeEach(() => {
    getProfile.mockReset();
    push.mockReset();
  });

  it('una cuenta sin verificar ve su perfil y el enlace para verificarse', async () => {
    auth.user = { ...base, isVerified: false };
    getProfile.mockResolvedValue({ ...base, isVerified: false });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lucía Pérez' })).toBeTruthy();
    expect(screen.getByText(/Identidad sin verificar/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Verificarla' }).getAttribute('href')).toBe('/tenant/kyc');
    expect(push).not.toHaveBeenCalled();
  });

  it('manda el estado que devuelve /api/users/me aunque la sesión guardada esté desfasada', async () => {
    auth.user = { ...base, isVerified: false };
    getProfile.mockResolvedValue({ ...base, isVerified: true });
    renderPage();

    expect(await screen.findByText(/Identidad verificada/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Verificarla' })).toBeNull();
  });
});
