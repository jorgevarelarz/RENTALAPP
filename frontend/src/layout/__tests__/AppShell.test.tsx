import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '../AppShell';

const { listConversationsMock, auth } = vi.hoisted(() => ({
  listConversationsMock: vi.fn(),
  auth: { current: null as null | { token?: string; user?: { _id: string; email: string; role: string } } },
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

  it('sin sesión no ofrece Mensajes ni Asistente, sino crear cuenta o entrar', async () => {
    auth.current = {};
    renderShell('/properties');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const dialog = screen.getByRole('dialog', { name: 'Menú' });
    expect(within(dialog).queryByRole('link', { name: /Mensajes/ })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: /Asistente/ })).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'Buscar pisos' })).toHaveAttribute('href', '/properties');
    expect(within(dialog).getByText(/guardas pisos, pides visitas/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register');
    expect(within(dialog).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(listConversationsMock).not.toHaveBeenCalled();
  });
});
