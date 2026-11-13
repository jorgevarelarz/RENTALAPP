import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSessionLost } from '../client';

const err = (status: number, code?: string) => ({ response: { status, data: { code } } });

describe('handleSessionLost', () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    assign.mockReset();
    localStorage.setItem('user', JSON.stringify({ _id: 'u1', role: 'tenant', token: 't' }));
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/contracts/abc', search: '?tab=pagos', assign },
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('con la sesión cerrada en el servidor borra la sesión y vuelve al login con el destino', () => {
    expect(handleSessionLost(err(401, 'session_expired'))).toBe(true);
    expect(localStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith(
      `/login?session=expired&redirect=${encodeURIComponent('/contracts/abc?tab=pagos')}`,
    );
  });

  it('también con un token caducado o mal formado', () => {
    expect(handleSessionLost(err(401, 'invalid_token'))).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('no toca la sesión con otros errores', () => {
    expect(handleSessionLost(err(401))).toBe(false);
    expect(handleSessionLost(err(403, 'session_expired'))).toBe(false);
    expect(handleSessionLost(err(500))).toBe(false);
    expect(handleSessionLost(new Error('red'))).toBe(false);
    expect(localStorage.getItem('user')).not.toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('sin sesión guardada no redirige', () => {
    localStorage.clear();
    expect(handleSessionLost(err(401, 'session_expired'))).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
