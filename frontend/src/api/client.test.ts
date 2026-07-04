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
});
