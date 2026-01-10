import React from 'react';
import { act, render } from '@testing-library/react';

// Mock router param id
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: (global as any).__mockId || 'c1' }),
}), { virtual: true });

// Mock AuthContext with configurable user
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => (global as any).__mockAuth || { token: 't', user: null },
}));

// Mock ToastContext to avoid provider
jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: jest.fn(), remove: jest.fn(), toasts: [] }),
}));

// Avoid importing real axios (ESM) via api/client
jest.mock('axios', () => {
  const axiosMock: any = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() };
  axiosMock.create = jest.fn(() => axiosMock);
  return { __esModule: true, default: axiosMock };
}, { virtual: true });

// Stub ChatPanel to avoid deep imports
jest.mock('../../components/ChatPanel', () => () => <div data-testid="chat" />);

// Mock services used by the page
jest.mock('../../services/contracts', () => ({
  __esModule: true,
  getContract: jest.fn(),
  createSignSession: jest.fn(),
}));

import ContractDetail from '../ContractDetail';
import * as contracts from '../../services/contracts';

function setAuth(user: any) {
  (global as any).__mockAuth = { token: 't', user };
}

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('ContractDetail polling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    (global as any).__mockAuth = { token: 't', user: null };
    (global as any).__mockId = 'c1';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no hace polling automatico', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as jest.Mock).mockResolvedValue({
      _id: 'c1',
      landlord: 'u1',
      status: 'pending_signature',
      rentAmount: 900,
      depositAmount: 900,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      landlordName: 'Landlord',
      tenantName: 'Tenant',
    });

    render(<ContractDetail />);
    await flushPromises();

    const initialCalls = (contracts.getContract as jest.Mock).mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    await flushPromises();

    expect((contracts.getContract as jest.Mock).mock.calls.length).toBe(initialCalls);
  });

  it('mantiene una sola carga aunque avance el tiempo', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as jest.Mock).mockResolvedValue({
      _id: 'c1',
      tenant: 'u2',
      status: 'active',
      rentAmount: 900,
      depositAmount: 900,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      landlordName: 'Landlord',
      tenantName: 'Tenant',
    });

    render(<ContractDetail />);
    await flushPromises();

    const initialCalls = (contracts.getContract as jest.Mock).mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(16000);
    });
    await flushPromises();

    expect((contracts.getContract as jest.Mock).mock.calls.length).toBe(initialCalls);
  });
});
