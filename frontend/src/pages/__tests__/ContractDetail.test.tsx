import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';

// Mock router param id
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
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
  getPaymentHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/coTenants', () => ({
  __esModule: true,
  listContractParties: vi.fn().mockResolvedValue([]),
  inviteCoTenant: vi.fn(),
  signAsCoTenant: vi.fn(),
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

    await screen.findByText(/esperar a que firmen las partes/i);
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
    expect(screen.getByRole('heading', { name: /estado del contrato/i })).toBeInTheDocument();
    expect(screen.getByText(/firma digital/i)).toBeInTheDocument();
  });

  test('En un contrato firmado el casero ve los cobros con su recibo; en un borrador no', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as Mock).mockResolvedValue({
      _id: 'c1',
      landlord: 'u1',
      status: 'active',
      rent: 900,
      deposit: 900,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-01-01T00:00:00.000Z',
    });
    (contracts.getPaymentHistory as Mock).mockResolvedValue([
      { _id: 'p1', type: 'rent', status: 'succeeded', amount: 900, billingMonth: 9, billingYear: 2026, paidAt: '2026-09-03T09:00:00Z' },
    ]);

    const { unmount } = render(<ContractDetail />);
    expect(await screen.findByRole('heading', { name: 'Cobros y recibos' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Descargar recibo: Renta de septiembre de 2026' })).toBeInTheDocument();
    expect(contracts.getPaymentHistory).toHaveBeenCalledWith('c1');
    unmount();

    (contracts.getPaymentHistory as Mock).mockClear();
    (contracts.getContract as Mock).mockResolvedValue({ _id: 'c1', landlord: 'u1', status: 'draft', rent: 900 });
    render(<ContractDetail />);
    await screen.findByRole('heading', { name: /estado del contrato/i });
    expect(screen.queryByRole('heading', { name: 'Cobros y recibos' })).toBeNull();
    expect(contracts.getPaymentHistory).not.toHaveBeenCalled();
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
    await screen.findByRole('heading', { name: /^condiciones$/i });
    expect(screen.queryByRole('button', { name: /pagar fianza/i })).toBeNull();
    unmount();

    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as Mock).mockResolvedValue({ ...signedContract, depositPaid: true });
    render(<ContractDetail />);
    await screen.findByRole('heading', { name: /^condiciones$/i });
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
  test('El co-titular no ve firmar ni pagar como inquilino principal', async () => {
    setAuth({ _id: 'u3', role: 'tenant' });
    (contracts.getContract as Mock).mockResolvedValue({ ...signedContract, status: 'pending_signature' });
    const { unmount } = render(<ContractDetail />);
    await screen.findByRole('heading', { name: /^condiciones$/i });
    expect(screen.queryByRole('button', { name: /firmar contrato/i })).toBeNull();
    unmount();

    (contracts.getContract as Mock).mockResolvedValue({ ...signedContract, tenant: { id: 'u2' }, tenantId: 'u2' });
    render(<ContractDetail />);
    await screen.findByRole('heading', { name: /^condiciones$/i });
    expect(screen.queryByRole('button', { name: /pagar fianza/i })).toBeNull();
  });

  test('La cabecera nombra el inmueble y no muestra el ID interno', async () => {
    setAuth({ _id: 'a1', role: 'agency' });
    (contracts.getContract as Mock).mockResolvedValue({
      ...signedContract,
      _id: '65f0c0ffee00000000abcdef',
      property: { title: 'Piso en Chamberí', address: 'Calle Fuencarral 120', city: 'Madrid' },
    });

    render(<ContractDetail />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Piso en Chamberí' })).toBeInTheDocument();
    expect(screen.getByText('Calle Fuencarral 120, Madrid')).toBeInTheDocument();
    expect(screen.queryByText(/ABCDEF/)).toBeNull();
    expect(screen.queryByRole('button', { name: /pagar fianza|firmar contrato/i })).toBeNull();
  });

  test('Muestra la fianza devuelta y avisa de las disputas abiertas, no de las cerradas', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as Mock).mockResolvedValue({
      ...signedContract,
      status: 'active',
      depositPaid: true,
      depositAmountRefunded: 1800,
      depositRefundedAt: '2027-11-05T10:00:00.000Z',
      depositDispute: { id: 'dp_dep', status: 'lost', amount: 1800 },
      rentDisputes: [
        { id: 'dp_rent', period: '2026-12', status: 'needs_response', amount: 900, reason: 'fraudulent', openedAt: '2026-12-10T10:00:00.000Z' },
      ],
    });

    render(<ContractDetail />);

    expect(await screen.findByText('Fianza devuelta', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText(/1\.?800,00\s*€ · 5\/11\/2027/)).toBeInTheDocument();
    expect(screen.getByText(/hay una reclamación abierta sobre un cobro/i)).toBeInTheDocument();
    expect(screen.getByText('Renta de diciembre de 2026')).toBeInTheDocument();
    expect(screen.getByText(/cargo no reconocido/)).toBeInTheDocument();
    // La disputa de la fianza ya está cerrada: no entra en el aviso.
    expect(screen.queryByText('Fianza', { selector: 'li span' })).toBeNull();
  });

  test('Sin disputas abiertas no hay aviso', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as Mock).mockResolvedValue({ ...signedContract, rentDisputes: [{ id: 'd', period: '2026-12', status: 'won' }] });

    render(<ContractDetail />);

    await screen.findByRole('heading', { name: /^condiciones$/i });
    expect(screen.queryByText(/reclamaci/i)).toBeNull();
    expect(screen.queryByText(/fianza devuelta/i)).toBeNull();
  });

  test('Si el contrato no carga, ofrece volver a la lista', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as Mock).mockRejectedValue(new Error('404'));

    render(<ContractDetail />);

    expect(await screen.findByText(/no encontramos este contrato/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a contratos/i })).toHaveAttribute('href', '/contracts');
  });
});
