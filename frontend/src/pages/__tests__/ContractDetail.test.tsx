import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock router param id
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: (global as any).__mockId || 'c1' })
}), { virtual: true });

// Mock AuthContext with configurable user
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => (global as any).__mockAuth || { token: 't', user: null }
}));

// Mock ToastContext to avoid provider
jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: jest.fn(), remove: jest.fn(), toasts: [] })
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

describe('ContractDetail', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).__mockAuth = { token: 't', user: null };
    (global as any).__mockId = 'c1';
  });

  test('Muestra boton de firma para tenant cuando esta pendiente de firma', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as jest.Mock).mockResolvedValue({
      _id: 'c1',
      tenant: 'u2',
      status: 'pending_signature',
      rentAmount: 900,
      depositAmount: 900,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      landlordName: 'Landlord',
      tenantName: 'Tenant',
    });

    render(<ContractDetail />);

    expect(await screen.findByRole('button', { name: /firmar con signaturit/i })).toBeInTheDocument();
  });

  test('No muestra boton de firma para landlord', async () => {
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

    await screen.findByText(/pendiente de firma/i);
    expect(screen.queryByRole('button', { name: /firmar con signaturit/i })).toBeNull();
  });

  test('Render defensivo: contrato cargado muestra accion de descarga', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as jest.Mock).mockResolvedValue({
      _id: 'c1',
      status: 'pending_signature',
      rentAmount: 900,
      depositAmount: 900,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      landlordName: 'Landlord',
      tenantName: 'Tenant',
    });

    render(<ContractDetail />);

    expect(await screen.findByRole('button', { name: /descargar borrador/i })).toBeInTheDocument();
  });
});
