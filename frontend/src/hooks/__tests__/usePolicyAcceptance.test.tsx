import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '../../api/client';
import { usePolicyAcceptance } from '../usePolicyAcceptance';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
const mockedApi = vi.mocked(api, { partial: false });

describe('usePolicyAcceptance', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns accepted=true when there is no token (no fetch)', async () => {
    const { result } = renderHook(() => usePolicyAcceptance(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccepted).toBe(true);
    expect(result.current.needsAcceptance).toBe(false);
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('marks as accepted when active versions match all required types', async () => {
    localStorage.setItem('token', 't');
    localStorage.setItem('policy_version_privacy_policy', 'v1.0');
    localStorage.setItem('policy_version_terms_of_service', 'v2.0');
    mockedApi.get.mockResolvedValueOnce({
      data: {
        data: [
          { policyType: 'privacy_policy', version: 'v1.0' },
          { policyType: 'terms_of_service', version: 'v2.0' },
        ],
      },
    } as any);

    const { result } = renderHook(() =>
      usePolicyAcceptance(undefined, ['privacy_policy', 'terms_of_service'])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsAcceptance).toBe(false);
    expect(result.current.hasAccepted).toBe(true);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/policies/active', {
      headers: { Authorization: 'Bearer t' },
    });
  });

  it('sets needsAcceptance when a required policy differs and resolves after POST', async () => {
    localStorage.setItem('token', 't');
    localStorage.setItem('policy_version_privacy_policy', 'v1.0');
    localStorage.setItem('policy_version_terms_of_service', 'v2.0');
    mockedApi.get.mockResolvedValueOnce({
      data: {
        data: [
          { policyType: 'privacy_policy', version: 'v1.0' },
          { policyType: 'terms_of_service', version: 'v2.1' },
        ],
      },
    } as any);
    mockedApi.post.mockResolvedValueOnce({ data: {} } as any);

    const { result } = renderHook(() =>
      usePolicyAcceptance(undefined, ['privacy_policy', 'terms_of_service'])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsAcceptance).toBe(true);
    expect(result.current.hasAccepted).toBe(false);
    expect(result.current.pendingPolicy?.policyType).toBe('terms_of_service');
    expect(result.current.pendingPolicy?.version).toBe('v2.1');

    await act(async () => {
      await result.current.acceptPolicy();
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/api/policies/accept',
      { policyType: 'terms_of_service', policyVersion: 'v2.1' },
      { headers: { Authorization: 'Bearer t' } }
    );
    expect(result.current.needsAcceptance).toBe(false);
    expect(result.current.hasAccepted).toBe(true);
  });
});
