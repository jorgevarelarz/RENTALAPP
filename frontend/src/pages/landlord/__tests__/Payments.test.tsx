import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LandlordPayments, { sortForLandlord } from '../Payments';

const { getPaymentsMock, downloadReceiptMock, pushMock, policy } = vi.hoisted(() => ({
  getPaymentsMock: vi.fn(),
  downloadReceiptMock: vi.fn(),
  pushMock: vi.fn(),
  policy: { needsAcceptance: false },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'token-1', user: { _id: 'landlord-1', role: 'landlord', name: 'Luis' } }),
}));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));
vi.mock('../../../services/payments', () => ({ getPayments: getPaymentsMock, downloadReceipt: downloadReceiptMock }));
vi.mock('../../../hooks/usePolicyAcceptance', () => ({
  usePolicyAcceptance: () => ({ needsAcceptance: policy.needsAcceptance, pendingPolicy: null, acceptPolicy: vi.fn() }),
}));
vi.mock('../../../components/PolicyModal', () => ({ default: () => null }));
vi.mock('../../../components/payments/PayoutAccountCard', () => ({ default: () => <div>Tarjeta de cuenta de cobros</div> }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <LandlordPayments />
    </MemoryRouter>,
  );

describe('Cobros del propietario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    policy.needsAcceptance = false;
  });

  it('enseña solo lo que cobra el propietario, con el total y el recibo de lo cobrado', async () => {
    getPaymentsMock.mockResolvedValue([
      { _id: 'a', type: 'rent', status: 'succeeded', amount: 900, billingMonth: 9, billingYear: 2026, payee: 'landlord-1', paidAt: '2026-09-03T09:00:00Z' },
      { _id: 'b', type: 'rent', status: 'pending', amount: 900, billingMonth: 10, billingYear: 2026, payee: 'landlord-1', dueDate: '2026-10-05T00:00:00Z' },
      { _id: 'c', type: 'service', status: 'succeeded', amount: 120, payee: 'pro-9', payer: 'landlord-1' },
    ]);
    renderPage();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Lo que falta por cobrar va primero.
    expect(items[0]).toHaveTextContent('Renta de octubre de 2026');
    expect(within(items[0]).queryByRole('button', { name: /Descargar recibo/ })).toBeNull();
    expect(items[1]).toHaveTextContent('Cobrado el');
    expect(within(items[1]).getByRole('button', { name: 'Descargar recibo: Renta de septiembre de 2026' })).toBeInTheDocument();
    expect(screen.getByText('900,00 €', { selector: 'span.font-semibold' })).toBeInTheDocument();
    expect(screen.getByText('Tarjeta de cuenta de cobros')).toBeInTheDocument();
  });

  it('sin cobros explica qué aparecerá', async () => {
    getPaymentsMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Todavía no has cobrado nada por RentalApp')).toBeInTheDocument();
  });

  it('si falla la carga ofrece reintentar', async () => {
    getPaymentsMock.mockRejectedValue({ response: { status: 500, data: { error: 'internal_server_error' } } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus cobros.');
    expect(screen.queryByText(/internal_server_error/)).toBeNull();
  });

  it('con condiciones pendientes las pide antes de cargar nada', async () => {
    policy.needsAcceptance = true;
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Acepta las condiciones para ver tus cobros' })).toBeInTheDocument();
    expect(getPaymentsMock).not.toHaveBeenCalled();
  });

  it('sortForLandlord: pendientes primero y lo cobrado de más reciente a más antiguo', () => {
    const sorted = sortForLandlord([
      { status: 'succeeded', paidAt: '2026-08-01' },
      { status: 'succeeded', paidAt: '2026-09-01' },
      { status: 'failed', createdAt: '2026-07-01' },
    ] as any);
    expect(sorted.map((p: any) => p.paidAt || p.status)).toEqual(['failed', '2026-09-01', '2026-08-01']);
  });
});
