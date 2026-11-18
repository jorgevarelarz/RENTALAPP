import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { post, push } = vi.hoisted(() => ({ post: vi.fn(), push: vi.fn() }));
vi.mock('../../../api/client', () => ({ api: { post, get: vi.fn(), defaults: { headers: { common: {} } } } }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push }) }));

import { AuthProvider } from '../../../context/AuthContext';
import ChangePasswordCard from '../ChangePasswordCard';

const stored = { _id: 'u1', email: 'ana@example.com', role: 'tenant', token: 'viejo' };

const renderCard = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <ChangePasswordCard />
      </AuthProvider>
    </MemoryRouter>,
  );

const fill = (current: string, next: string, repeat = next) => {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), { target: { value: repeat } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
};

describe('ChangePasswordCard', () => {
  beforeEach(() => {
    post.mockReset();
    push.mockReset();
    localStorage.setItem('user', JSON.stringify(stored));
  });
  afterEach(() => localStorage.clear());

  it('cambia la contraseña y guarda el token nuevo para seguir dentro', async () => {
    post.mockResolvedValue({ data: { ok: true, token: 'nuevo' } });
    renderCard();
    fill('password123', 'nueva-clave-123');
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' })));
    expect(post).toHaveBeenCalledWith('/api/auth/change-password', {
      currentPassword: 'password123',
      password: 'nueva-clave-123',
    });
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ _id: 'u1', token: 'nuevo' });
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull();
  });

  it('no envía nada si la nueva es corta o no coincide', () => {
    renderCard();
    fill('password123', 'corta');
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'nueva-clave-123' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), { target: { value: 'nueva-clave-124' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
    expect(post).not.toHaveBeenCalled();
  });

  it('muestra en español que la contraseña actual no es correcta y conserva la sesión', async () => {
    post.mockRejectedValue({ response: { status: 400, data: { error: 'wrong_password' } } });
    renderCard();
    fill('mal', 'nueva-clave-123');
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.');
    expect(JSON.parse(localStorage.getItem('user')!).token).toBe('viejo');
  });

  it('a una cuenta de Google sin contraseña le ofrece elegirla por correo', async () => {
    post.mockRejectedValue({ response: { status: 400, data: { error: 'password_not_set' } } });
    renderCard();
    fill('cualquiera', 'nueva-clave-123');
    expect(await screen.findByRole('link', { name: 'Elige una por correo' })).toHaveAttribute('href', '/forgot-password');
  });
});
