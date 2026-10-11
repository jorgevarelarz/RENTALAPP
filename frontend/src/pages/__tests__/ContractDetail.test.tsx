import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';

// Mock router param id
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: (global as any).__mockId || 'c1' }),
  useSearchParams: () => [new URLSearchParams((global as any).__mockSearch || ''), (global as any).__mockSetSearch || (() => {})]
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
  payDeposit: vi.fn(),
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
    (global as any).__mockSearch = '';
    (global as any).__mockSetSearch = undefined;
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

    expect(await screen.findByRole('button', { name: /firmar contrato/i })).toBeInTheDocument();
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

    await screen.findByRole('heading', { name: /pendiente de firma/i });
    expect(screen.queryByRole('button', { name: /firmar contrato/i })).toBeNull();
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
    expect(screen.getByText(/timeline legal/i)).toBeInTheDocument();
    expect(screen.getByText(/firma digital/i)).toBeInTheDocument();
  });

  const signedContract = {
    _id: 'c1',
    tenant: 'u2',
    status: 'signed',
    rent: 900,
    deposit: 1800,
    depositPaid: false,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2027-10-31T00:00:00.000Z',
    landlordName: 'Landlord',
    tenantName: 'Tenant',
  };

  test('Muestra renta y fianza del contrato y lleva al inquilino a Stripe al pagar la fianza', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as Mock).mockResolvedValue(signedContract);
    (contracts.payDeposit as Mock).mockResolvedValue({ sessionUrl: 'https://checkout.stripe.test/s1' });
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } });

    try {
      render(<ContractDetail />);
      const button = await screen.findByRole('button', { name: /pagar fianza/i });
      expect(button).toHaveTextContent(/1\.?800,00/);
      expect(screen.queryByText(/undefined/)).toBeNull();

      await userEvent.click(button);
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/s1'));
      expect(contracts.payDeposit).toHaveBeenCalledWith('t', 'c1');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  test('No ofrece pagar la fianza al propietario ni si ya esta pagada', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as Mock).mockResolvedValue(signedContract);
    const { unmount } = render(<ContractDetail />);
    await screen.findByText(/resumen econ/i);
    expect(screen.queryByRole('button', { name: /pagar fianza/i })).toBeNull();
    unmount();

    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as Mock).mockResolvedValue({ ...signedContract, depositPaid: true });
    render(<ContractDetail />);
    await screen.findByText(/resumen econ/i);
    expect(screen.queryByRole('button', { name: /pagar fianza/i })).toBeNull();
  });

  test('Al volver de Stripe avisa de que el pago se esta confirmando y limpia el parametro', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    const setSearch = vi.fn();
    (global as any).__mockSearch = 'deposit=success';
    (global as any).__mockSetSearch = setSearch;
    (contracts.getContract as Mock).mockResolvedValue(signedContract);

    render(<ContractDetail />);

    expect(await screen.findByText(/pago de la fianza recibido/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar fianza/i })).toBeNull();
    expect(setSearch).toHaveBeenCalled();
    expect((setSearch.mock.calls[0][0] as URLSearchParams).has('deposit')).toBe(false);
  });

  test('Al cancelar en Stripe avisa sin cargo y deja reintentar', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (global as any).__mockSearch = 'deposit=cancel';
    (contracts.getContract as Mock).mockResolvedValue(signedContract);

    render(<ContractDetail />);

    expect(await screen.findByText(/pago de la fianza cancelado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pagar fianza/i })).toBeInTheDocument();
  });
});
