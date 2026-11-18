import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api/client', () => ({ api: { get, defaults: { headers: { common: {} } } } }));

import { refreshStoredUser } from '../auth';
import { AuthProvider, useAuth } from '../../context/AuthContext';

const stored = { _id: 'u1', email: 'ana@example.com', role: 'admin', isVerified: true, token: 't1' };

describe('refreshStoredUser', () => {
  beforeEach(() => {
    get.mockReset();
    localStorage.setItem('user', JSON.stringify(stored));
  });
  afterEach(() => localStorage.clear());

  it('actualiza rol y verificación con /api/users/me y conserva el token', async () => {
    get.mockResolvedValue({ data: { id: 'u1', email: 'ana@example.com', role: 'tenant', isVerified: false } });
    const fresh = await refreshStoredUser();
    expect(get).toHaveBeenCalledWith('/api/users/me');
    expect(fresh).toMatchObject({ _id: 'u1', role: 'tenant', isVerified: false, token: 't1' });
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ role: 'tenant', isVerified: false, token: 't1' });
  });

  it('sin sesión guardada no consulta nada', async () => {
    localStorage.clear();
    expect(await refreshStoredUser()).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('si la consulta falla deja la sesión como estaba', async () => {
    get.mockRejectedValue(new Error('red'));
    expect(await refreshStoredUser()).toBeNull();
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(stored);
  });

  it('una verificación retirada (403 owner_not_verified) se refleja en la sesión guardada', async () => {
    get.mockRejectedValue({ response: { status: 403, data: { error: 'owner_not_verified' } } });
    const fresh = await refreshStoredUser();
    expect(fresh).toMatchObject({ role: 'admin', isVerified: false, token: 't1' });
  });

  it('no pisa una sesión que cambió mientras llegaba la respuesta', async () => {
    get.mockImplementation(async () => {
      localStorage.setItem('user', JSON.stringify({ ...stored, token: 't2', role: 'landlord' }));
      return { data: { role: 'tenant', isVerified: false } };
    });
    expect(await refreshStoredUser()).toBeNull();
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ token: 't2', role: 'landlord' });
  });
});

function RoleProbe() {
  const { user } = useAuth();
  return <span>rol: {user?.role ?? 'ninguno'}</span>;
}

describe('AuthProvider', () => {
  afterEach(() => localStorage.clear());

  it('al arrancar sustituye el rol del login por el de la base', async () => {
    localStorage.setItem('user', JSON.stringify(stored));
    get.mockResolvedValue({ data: { role: 'tenant', isVerified: true } });
    render(
      <AuthProvider>
        <RoleProbe />
      </AuthProvider>,
    );
    expect(screen.getByText('rol: admin')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('rol: tenant')).toBeInTheDocument());
  });
});
