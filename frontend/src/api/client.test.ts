import { describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => {
  const axiosMock: any = { interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } };
  axiosMock.create = vi.fn(() => axiosMock);
  return { __esModule: true, default: axiosMock };
});

import { formatApiError, getApiErrorRequestId } from './client';

describe('api client errors', () => {
  it('formats request id from response body', () => {
    const err = { response: { data: { error: 'forbidden', requestId: 'req_body' } } };
    expect(getApiErrorRequestId(err)).toBe('req_body');
    expect(formatApiError(err)).toBe('forbidden (ref: req_body)');
  });

  it('formats request id from response headers', () => {
    const err = { response: { data: { message: 'No autorizado' }, headers: { 'x-request-id': 'req_header' } } };
    expect(formatApiError(err)).toBe('No autorizado (ref: req_header)');
  });

  it('can omit the request id from expected user-facing errors', () => {
    const err = {
      response: {
        data: { message: 'Usuario o contraseña incorrectos', requestId: 'req_login' },
      },
    };

    expect(formatApiError(err, 'Error de login', { includeRequestId: false }))
      .toBe('Usuario o contraseña incorrectos');
  });

  it('explains the verification error in Spanish without a reference', () => {
    const err = { response: { status: 403, data: { error: 'owner_not_verified', requestId: 'req_v' } } };
    expect(formatApiError(err, 'No se pudo cargar')).toBe('Necesitas verificar tu identidad para usar esta sección.');
    const other = { response: { status: 403, data: { error: 'forbidden', requestId: 'req_f' } } };
    expect(formatApiError(other)).toBe('forbidden (ref: req_f)');
  });
});
