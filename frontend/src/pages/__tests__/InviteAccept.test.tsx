import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InviteAccept from '../InviteAccept';

const { getInviteMock, acceptMock } = vi.hoisted(() => ({
  getInviteMock: vi.fn(),
  acceptMock: vi.fn(),
}));

vi.mock('../../services/agency', () => ({
  getInvite: getInviteMock,
  acceptInvite: acceptMock,
}));

vi.mock('../../services/auth', () => ({ setStoredUser: vi.fn() }));

const invite = {
  landlordName: 'Paco Prop',
  landlordEmail: 'paco@example.com',
  propertyAddress: 'Calle Real 1',
  agencyName: 'Inmo Centro',
  status: 'invited' as const,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/invite/abc123']}>
      <Routes>
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InviteAccept (invitación de agencia a propietario)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInviteMock.mockResolvedValue(invite);
  });

  it('muestra la agencia, el inmueble y el correo invitado', async () => {
    renderPage();
    expect(await screen.findByText('Activa tu cuenta')).toBeInTheDocument();
    expect(screen.getByText('Inmo Centro')).toBeInTheDocument();
    expect(screen.getByText('Calle Real 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('paco@example.com')).toBeDisabled();
    expect(getInviteMock).toHaveBeenCalledWith('abc123');
  });

  it('solo un 404 da el enlace por no válido', async () => {
    getInviteMock.mockRejectedValueOnce({ response: { status: 404, data: { error: 'invite_not_found' } } });
    renderPage();
    expect(await screen.findByText('Invitación no válida')).toBeInTheDocument();
  });

  it('un 401 o un fallo de red deja reintentar en vez de decir que el enlace no vale', async () => {
    getInviteMock.mockRejectedValueOnce({ response: { status: 401, data: { error: 'Token requerido' } } });
    renderPage();
    expect(await screen.findByText('No se pudo cargar la invitación')).toBeInTheDocument();
    expect(screen.queryByText('Invitación no válida')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Activa tu cuenta')).toBeInTheDocument();
  });

  it('si el correo ya tiene cuenta lo dice en español y enlaza a iniciar sesión', async () => {
    acceptMock.mockRejectedValueOnce({ response: { status: 409, data: { error: 'user_already_exists' } } });
    renderPage();
    fireEvent.change(await screen.findByLabelText(/Crea tu contraseña/), { target: { value: 'supersegura1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ya hay una cuenta con este correo');
    expect(alert).not.toHaveTextContent('user_already_exists');
    fireEvent.click(screen.getByRole('link', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
  });

  it('una invitación caducada al activar lo explica sin enlace a iniciar sesión', async () => {
    acceptMock.mockRejectedValueOnce({ response: { status: 410, data: { error: 'invite_expired' } } });
    renderPage();
    fireEvent.change(await screen.findByLabelText(/Crea tu contraseña/), { target: { value: 'supersegura1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La invitación ha caducado');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });
});
