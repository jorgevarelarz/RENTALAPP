import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '../AppShell';

const { listConversationsMock, auth } = vi.hoisted(() => ({
  listConversationsMock: vi.fn(),
  auth: {
    current: null as null | { token?: string; user?: { _id: string; email: string; role: string; isVerified?: boolean } },
  },
}));

const tenantAuth = { token: 'token-1', user: { _id: 'tenant-1', email: 'ana@example.com', role: 'tenant' } };

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ ...auth.current, logout: vi.fn() }),
}));

vi.mock('../../services/chat', () => ({
  listConversations: listConversationsMock,
}));

function renderShell(path = '/tenant') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/tenant" element={<p>Inicio del inquilino</p>} />
          <Route path="/tenant/payments" element={<p>Página de pagos</p>} />
          <Route path="/properties" element={<p>Listado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell, menú del móvil', () => {
  beforeEach(() => {
    auth.current = tenantAuth;
    listConversationsMock.mockReset();
    listConversationsMock.mockResolvedValue([{ unread: { 'tenant-1': 2 } }]);
  });

  it('abre el menú con los enlaces del rol, navega y se cierra', async () => {
    renderShell();
    const menuButton = await screen.findByRole('button', { name: 'Abrir menú (2 mensajes sin leer)' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(menuButton);
    expect(dialog).toHaveAttribute('aria-hidden', 'false');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('link', { name: /Mensajes/ })).toHaveTextContent('2');
    expect(within(dialog).getByText('ana@example.com')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('link', { name: 'Pagos' }));
    expect(await screen.findByText('Página de pagos')).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
  });

  it('se cierra con Escape y consulta los no leídos una sola vez', async () => {
    renderShell();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir menú/ }));
    const dialog = screen.getByRole('dialog', { name: 'Menú' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    await waitFor(() => expect(listConversationsMock).toHaveBeenCalledTimes(1));
  });

  it('sin sesión no ofrece Mensajes ni Asistente, sino crear cuenta o entrar y volver a la búsqueda', async () => {
    auth.current = {};
    renderShell('/properties?city=Madrid');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const dialog = screen.getByRole('dialog', { name: 'Menú' });
    expect(within(dialog).queryByRole('link', { name: /Mensajes/ })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: /Asistente/ })).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'Buscar pisos' })).toHaveAttribute('href', '/properties');
    expect(within(dialog).getByText(/guardas pisos, pides visitas/)).toBeInTheDocument();
    const back = encodeURIComponent('/properties?city=Madrid');
    expect(within(dialog).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', `/register?redirect=${back}`);
    expect(within(dialog).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', `/login?redirect=${back}`);
    expect(listConversationsMock).not.toHaveBeenCalled();
  });
});

describe('AppShell, cuenta sin verificar', () => {
  beforeEach(() => {
    listConversationsMock.mockReset();
    listConversationsMock.mockResolvedValue([]);
  });

  it('avisa al inquilino, enlaza a la verificación y no sondea los mensajes', async () => {
    auth.current = { token: 't', user: { ...tenantAuth.user, isVerified: false } };
    renderShell();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Tu identidad está sin verificar');
    expect(within(notice).getByRole('link', { name: 'Ver qué falta' })).toHaveAttribute('href', '/tenant/kyc');
    expect(await screen.findByText('Inicio del inquilino')).toBeInTheDocument();
    expect(listConversationsMock).not.toHaveBeenCalled();
  });

  it('al propietario se lo explica sin enlace y no sale con la identidad verificada', () => {
    auth.current = { token: 't', user: { _id: 'l1', email: 'luis@example.com', role: 'landlord', isVerified: false } };
    const { unmount } = renderShell();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('no podrás usar contratos, mensajes ni pagos');
    expect(within(notice).queryByRole('link')).toBeNull();
    unmount();

    auth.current = { token: 't', user: { ...tenantAuth.user, isVerified: true } };
    renderShell();
    expect(screen.queryByText('Tu identidad está sin verificar')).toBeNull();
  });
});
