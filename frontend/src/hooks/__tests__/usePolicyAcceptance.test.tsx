import { renderHook, act, waitFor } from '@testing-library/react';
import axios from 'axios';
import { usePolicyAcceptance } from '../usePolicyAcceptance';

jest.mock('axios');
const mockedAxios = jest.mocked(axios, { shallow: false });

describe('usePolicyAcceptance', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('returns accepted=true when there is no token (no fetch)', async () => {
    const { result } = renderHook(() => usePolicyAcceptance(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccepted).toBe(true);
    expect(result.current.needsAcceptance).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('marks as accepted when API reports existing acceptance', async () => {
    localStorage.setItem('token', 't');
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ policyType: 'privacy_policy', policyVersion: 'v1.0' }] },
    } as any);

    const { result } = renderHook(() => usePolicyAcceptance());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsAcceptance).toBe(false);
    expect(result.current.hasAccepted).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/policies', {
      headers: { Authorization: 'Bearer t' },
    });
  });

  it('sets needsAcceptance when API returns no acceptance and resolves after POST', async () => {
    localStorage.setItem('token', 't');
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } } as any);
    mockedAxios.post.mockResolvedValueOnce({ data: {} } as any);

    const { result } = renderHook(() => usePolicyAcceptance());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsAcceptance).toBe(true);
    expect(result.current.hasAccepted).toBe(false);

    await act(async () => {
      await result.current.acceptPolicy();
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/policies/accept',
      { policyType: 'privacy_policy', policyVersion: 'v1.0' },
      { headers: { Authorization: 'Bearer t' } }
    );
    expect(result.current.needsAcceptance).toBe(false);
    expect(result.current.hasAccepted).toBe(true);
  });
});
