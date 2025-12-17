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
  sendToSignature: jest.fn(),
  downloadPdf: jest.fn(),
  payDeposit: jest.fn(),
  signContract: jest.fn(),
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

  it('polls load() every 8s when signature is sent', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as jest.Mock).mockResolvedValue({ id: 'c1', owner: { id: 'u1' }, status: 'signing', signature: { status: 'sent' } });

    render(<ContractDetail />);
    await flushPromises();

    expect(contracts.getContract).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    await flushPromises();

    // 1 inicial + 2 intervalos
    expect(contracts.getContract).toHaveBeenCalledTimes(3);
  });

  it('does not poll when signature is completed', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as jest.Mock).mockResolvedValue({ id: 'c1', tenant: 'u2', status: 'signed', signature: { status: 'completed' } });

    render(<ContractDetail />);
    await flushPromises();

    expect(contracts.getContract).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(16000);
    });
    await flushPromises();

    expect(contracts.getContract).toHaveBeenCalledTimes(1);
  });
});
