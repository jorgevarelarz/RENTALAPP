import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CoTenantInviteAccept from '../CoTenantInviteAccept';

const { previewMock, acceptMock, logoutMock, auth } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  acceptMock: vi.fn(),
  logoutMock: vi.fn(),
  auth: { user: null as null | { _id: string; email: string; role: string } },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: auth.user ? 't' : null, user: auth.user, logout: logoutMock }),
}));

vi.mock('../../services/coTenants', () => ({
  getCoTenantInvitePreview: previewMock,
  acceptCoTenantInvite: acceptMock,
}));

const invite = {
  email: 'co@example.com',
  expired: false,
  inviterName: 'Lucía Pérez',
  property: { title: 'Piso en Chamberí', address: 'Calle Luchana 12', city: 'Madrid' },
};

function renderPage(token = 'tok123') {
  return render(
    <MemoryRouter initialEntries={[`/invites/accept?token=${token}`]}>
      <Routes>
        <Route path="/invites/accept" element={<CoTenantInviteAccept />} />
        <Route path="/contracts/:id" element={<p>Detalle del contrato</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CoTenantInviteAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
    previewMock.mockResolvedValue(invite);
  });

  it('sin sesión muestra la invitación y lleva a entrar o registrarse volviendo a ella', async () => {
    renderPage();
    expect(await screen.findByText('Piso en Chamberí')).toBeInTheDocument();
    expect(previewMock).toHaveBeenCalledWith('tok123');
    expect(screen.getByText('Calle Luchana 12, Madrid')).toBeInTheDocument();
    expect(screen.getByText('Lucía Pérez')).toBeInTheDocument();
    const back = encodeURIComponent('/invites/accept?token=tok123');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', `/login?redirect=${back}`);
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      `/register?role=tenant&email=co%40example.com&redirect=${back}`,
    );
    expect(screen.queryByRole('button', { name: /aceptar invitación/i })).toBeNull();
  });

  it('con la cuenta invitada acepta y abre el contrato', async () => {
    auth.user = { _id: 'u9', email: 'Co@Example.com', role: 'tenant' };
    acceptMock.mockResolvedValue({ ok: true, partyId: 'p1', contractId: 'c42' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText('Detalle del contrato')).toBeInTheDocument();
    expect(acceptMock).toHaveBeenCalledWith('tok123');
  });

  it('si falta la verificación de identidad lo explica y enlaza a verificarla', async () => {
    auth.user = { _id: 'u9', email: 'co@example.com', role: 'tenant' };
    acceptMock.mockRejectedValue({ response: { status: 403, data: { error: 'owner_not_verified' } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('verificar tu identidad');
    expect(screen.getByRole('link', { name: 'Verificar identidad' })).toHaveAttribute('href', '/tenant/kyc');
    expect(screen.getByRole('button', { name: 'Aceptar invitación' })).not.toBeDisabled();
  });

  it('con otra cuenta ofrece cambiarla en lugar de aceptar', async () => {
    auth.user = { _id: 'u1', email: 'otra@example.com', role: 'tenant' };
    renderPage();
    expect(await screen.findByText(/Has entrado como otra@example.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar invitación' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de cuenta' }));
    expect(logoutMock).toHaveBeenCalled();
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
  });

  it('avisa si el enlace no es válido o ha caducado', async () => {
    previewMock.mockRejectedValueOnce({ response: { status: 404 } });
    const { unmount } = renderPage();
    expect(await screen.findByText('Invitación no válida')).toBeInTheDocument();
    unmount();

    previewMock.mockResolvedValueOnce({ ...invite, expired: true });
    renderPage();
    expect(await screen.findByText('Invitación caducada')).toBeInTheDocument();
    expect(screen.getByText(/Lucía Pérez/)).toBeInTheDocument();
  });
});
