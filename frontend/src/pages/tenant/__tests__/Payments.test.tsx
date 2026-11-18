import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Payments from '../Payments';
import { paymentTitle } from '../../../utils/payments';

const { getPaymentsMock, payReceiptMock, downloadReceiptMock, pushMock } = vi.hoisted(() => ({
  getPaymentsMock: vi.fn(),
  payReceiptMock: vi.fn(),
  downloadReceiptMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'token-1', user: { _id: 'tenant-1', role: 'tenant', name: 'Ana' } }),
}));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));
vi.mock('../../../services/payments', () => ({
  getPayments: getPaymentsMock,
  payReceipt: payReceiptMock,
  downloadReceipt: downloadReceiptMock,
}));
vi.mock('../../../components/payments/PaymentModal', () => ({ default: () => <div>Modal de pago</div> }));

describe('Pagos y recibos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPaymentsMock.mockResolvedValue([
      { _id: 'p-paid', type: 'rent', status: 'succeeded', amount: 950, billingMonth: 9, billingYear: 2026, payer: 'tenant-1', paidAt: '2026-09-03T09:00:00Z' },
      { _id: 'p-due', type: 'rent', status: 'pending', amount: 950, billingMonth: 10, billingYear: 2026, payer: 'tenant-1', dueDate: '2026-10-05T00:00:00Z' },
      { _id: 'p-other', type: 'rent', status: 'pending', amount: 500, billingMonth: 10, billingYear: 2026, payer: 'someone-else' },
      { _id: 'p-dep', type: 'deposit', status: 'refunded', amount: 1900, payer: 'tenant-1' },
    ]);
  });

  it('pone lo pendiente primero, solo deja pagar lo propio y ofrece el recibo de lo cobrado', async () => {
    render(<Payments />);
    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Renta de octubre de 2026');
    expect(items[0]).toHaveTextContent('950,00 €');
    expect(within(items[0]).getByRole('button', { name: 'Pagar ahora' })).toBeInTheDocument();
    // Un recibo que paga otra persona no se puede pagar desde aquí.
    expect(within(items[1]).queryByRole('button', { name: 'Pagar ahora' })).toBeNull();

    const paid = items.find(li => li.textContent?.includes('Renta de septiembre de 2026'))!;
    expect(paid).toHaveTextContent('Pagado el');
    expect(within(paid).queryByRole('button', { name: 'Pagar ahora' })).toBeNull();

    // La fianza devuelta no tiene recibo.
    const deposit = items.find(li => li.textContent?.includes('Fianza'))!;
    expect(within(deposit).queryByRole('button', { name: /Descargar recibo/ })).toBeNull();
  });

  it('descarga el PDF del recibo', async () => {
    downloadReceiptMock.mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
    const createUrl = vi.fn(() => 'blob:recibo');
    const revokeUrl = vi.fn();
    Object.assign(window.URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<Payments />);
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar recibo: Renta de septiembre de 2026' }));

    await waitFor(() => expect(downloadReceiptMock).toHaveBeenCalledWith('token-1', 'p-paid'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(revokeUrl).toHaveBeenCalledWith('blob:recibo');
    expect(pushMock).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('avisa si el recibo no se puede descargar y si la lista no carga', async () => {
    downloadReceiptMock.mockRejectedValue(new Error('500'));
    const { unmount } = render(<Payments />);
    fireEvent.click(await screen.findByRole('button', { name: /Descargar recibo/ }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith({ title: 'No se pudo descargar el recibo', tone: 'error' }),
    );
    unmount();

    getPaymentsMock.mockRejectedValue(new Error('500'));
    render(<Payments />);
    expect(await screen.findByText(/No se pudieron cargar los pagos/)).toBeInTheDocument();
  });

  it('titula cada pago por su mes', () => {
    expect(paymentTitle({ type: 'rent', billingMonth: 1, billingYear: 2027 })).toBe('Renta de enero de 2027');
    expect(paymentTitle({ type: 'deposit' })).toBe('Fianza');
    expect(paymentTitle({ type: 'service', concept: 'Fontanería' })).toBe('Fontanería');
  });
});
