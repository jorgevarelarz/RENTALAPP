import { describe, expect, it } from 'vitest';
import { authHref, returnPath, withIntent } from '../authLinks';

describe('authLinks', () => {
  it('vuelve a la página de origen con su consulta y su ancla', () => {
    expect(returnPath({ pathname: '/properties/abc', search: '?x=1', hash: '#mapa' })).toBe('/properties/abc?x=1#mapa');
    expect(authHref('/login', { pathname: '/properties', search: '?city=Madrid' })).toBe(
      `/login?redirect=${encodeURIComponent('/properties?city=Madrid')}`,
    );
  });

  it('desde el inicio o las pantallas de acceso no añade vuelta', () => {
    for (const pathname of ['/', '/login', '/register', '/forgot-password', '/reset', '/auth/callback']) {
      expect(authHref('/register', { pathname })).toBe('/register');
    }
    expect(returnPath({ pathname: '/registered-users' })).toBe('/registered-users');
  });

  it('añade la intención sin perder la consulta ni repetirla', () => {
    expect(withIntent({ pathname: '/properties/p1', search: '?a=1', hash: '#x' }, 'save')).toEqual({
      pathname: '/properties/p1',
      search: '?a=1&intent=save',
      hash: '#x',
    });
    expect(withIntent({ pathname: '/properties/p1', search: '?intent=apply' }, 'save').search).toBe('?intent=save');
  });
});
