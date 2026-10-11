import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resetMock, registerMock, loginMock } = vi.hoisted(() => ({
  resetMock: vi.fn(),
  registerMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock('../../../services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/auth')>();
  return { ...actual, resetPassword: resetMock, register: registerMock };
});

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock('../../../components/SocialAuthButtons', () => ({ default: () => null }));

import ResetPassword from '../ResetPassword';
import RegisterPage from '../RegisterPage';
import LoginPage from '../LoginPage';

beforeEach(() => {
  resetMock.mockReset();
  registerMock.mockReset();
  loginMock.mockReset();
});

describe('ResetPassword', () => {
  beforeEach(() => window.history.pushState({}, '', '/reset?token=abc'));

  it('no envía una contraseña de menos de 8 caracteres', () => {
    render(<MemoryRouter><ResetPassword /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: '1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('tras cambiarla ofrece iniciar sesión', async () => {
    resetMock.mockResolvedValue(undefined);
    render(<MemoryRouter><ResetPassword /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva-clave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument();
    expect(resetMock).toHaveBeenCalledWith('abc', 'nueva-clave');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
  });
});

describe('RegisterPage', () => {
  it('no registra con una contraseña de menos de 8 caracteres', () => {
    render(<MemoryRouter initialEntries={['/register']}><RegisterPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'corta' } });
    fireEvent.submit(screen.getByLabelText('Contraseña').closest('form')!);
    expect(screen.getByText(/al menos 8 caracteres/)).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });
});

describe('LoginPage', () => {
  it('ante credenciales incorrectas recuerda el acceso con Google o Apple', async () => {
    loginMock.mockRejectedValue({ response: { data: { message: 'Usuario o contraseña incorrectos' } } });
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.es' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Usuario o contraseña incorrectos. Si creaste la cuenta con Google o Apple, entra con ese botón.',
      ),
    );
  });

  it('no añade la pista a otros errores', async () => {
    loginMock.mockRejectedValue({ response: { data: { message: 'Demasiados intentos. Espera 15 minutos.' } } });
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.es' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Demasiados intentos'));
    expect(screen.getByRole('alert')).not.toHaveTextContent('Google o Apple');
  });
});
