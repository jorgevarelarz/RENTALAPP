import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';

// Mock router param id
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: (global as any).__mockId || 'c1' })
}), { virtual: true });

// Mock AuthContext with configurable user
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => (global as any).__mockAuth || { token: 't', user: null }
}));

// Mock ToastContext to avoid provider
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), remove: vi.fn(), toasts: [] })
}));

// Avoid importing real axios (ESM) via api/client
vi.mock('axios', () => {
  const axiosMock: any = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  axiosMock.create = vi.fn(() => axiosMock);
  return { __esModule: true, default: axiosMock };
}, { virtual: true });

// Stub ChatPanel to avoid deep imports
vi.mock('../../components/ChatPanel', () => ({
  default: () => <div data-testid="chat" />,
}));

// Mock services used by the page
vi.mock('../../services/contracts', () => ({
  __esModule: true,
  getContract: vi.fn(),
  createSignSession: vi.fn(),
}));

import ContractDetail from '../ContractDetail';
import * as contracts from '../../services/contracts';

function setAuth(user: any) {
  (global as any).__mockAuth = { token: 't', user };
}

describe('ContractDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (global as any).__mockAuth = { token: 't', user: null };
    (global as any).__mockId = 'c1';
  });

  test('Muestra boton de firma para tenant cuando esta pendiente de firma', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as Mock).mockResolvedValue({
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
    (contracts.getContract as Mock).mockResolvedValue({
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
    (contracts.getContract as Mock).mockResolvedValue({
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
