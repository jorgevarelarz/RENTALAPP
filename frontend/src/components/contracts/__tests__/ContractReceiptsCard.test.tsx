import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContractReceiptsCard from '../ContractReceiptsCard';

const { getPaymentHistoryMock, downloadReceiptMock, pushMock } = vi.hoisted(() => ({
  getPaymentHistoryMock: vi.fn(),
  downloadReceiptMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));
vi.mock('../../../services/contracts', () => ({ getPaymentHistory: getPaymentHistoryMock }));
vi.mock('../../../services/payments', () => ({ downloadReceipt: downloadReceiptMock }));

const rent = (month: number, extra: Record<string, unknown> = {}) => ({
  _id: `r-${month}`,
  type: 'rent',
  status: 'succeeded',
  amount: 950,
  billingMonth: month,
  billingYear: 2026,
  paidAt: `2026-${String(month).padStart(2, '0')}-03T09:00:00Z`,
  ...extra,
});

describe('Cobros y recibos del contrato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista cada cobro por su mes con importe y devolución, y descarga su recibo', async () => {
    getPaymentHistoryMock.mockResolvedValue([
      rent(10, { amountRefunded: 50 }),
      { _id: 'dep', type: 'deposit', status: 'succeeded', amount: 1900, paidAt: '2026-01-02T09:00:00Z' },
    ]);
    downloadReceiptMock.mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
    Object.assign(window.URL, { createObjectURL: vi.fn(() => 'blob:recibo'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ContractReceiptsCard contractId="c1" token="token-1" />);
    const items = await screen.findAllByRole('listitem');
    expect(getPaymentHistoryMock).toHaveBeenCalledWith('c1');
    expect(items[0]).toHaveTextContent('Renta de octubre de 2026');
    expect(items[0]).toHaveTextContent('950,00 €');
    expect(items[0]).toHaveTextContent('devueltos 50,00 €');
    expect(items[1]).toHaveTextContent('Fianza');

    fireEvent.click(within(items[1]).getByRole('button', { name: 'Descargar recibo: Fianza' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(downloadReceiptMock).toHaveBeenCalledWith('token-1', 'dep');
    click.mockRestore();
  });

  it('enseña los seis últimos y deja ver el resto', async () => {
    getPaymentHistoryMock.mockResolvedValue([10, 9, 8, 7, 6, 5, 4, 3].map((m) => rent(m)));
    render(<ContractReceiptsCard contractId="c1" token="token-1" />);
    expect(await screen.findAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Ver los 2 cobros anteriores' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('sin cobros lo dice; si falla la descarga avisa', async () => {
    getPaymentHistoryMock.mockResolvedValue([]);
    const { unmount } = render(<ContractReceiptsCard contractId="c1" token="token-1" />);
    expect(await screen.findByText(/Aún no hay cobros/)).toBeInTheDocument();
    unmount();

    getPaymentHistoryMock.mockResolvedValue([rent(9)]);
    downloadReceiptMock.mockRejectedValue(new Error('500'));
    render(<ContractReceiptsCard contractId="c1" token="token-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Descargar recibo/ }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith({ title: 'No se pudo descargar el recibo', tone: 'error' }));
  });

  it('sin permiso no se muestra; con otro error lo explica', async () => {
    getPaymentHistoryMock.mockRejectedValue({ response: { status: 403 } });
    const { container, unmount } = render(<ContractReceiptsCard contractId="c1" token="token-1" />);
    await waitFor(() => expect(getPaymentHistoryMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
    unmount();

    getPaymentHistoryMock.mockRejectedValue({ response: { status: 500 } });
    render(<ContractReceiptsCard contractId="c1" token="token-1" />);
    expect(await screen.findByText(/No se pudieron cargar los cobros/)).toBeInTheDocument();
  });
});
