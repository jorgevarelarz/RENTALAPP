import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProBilling from '../Billing';
import ProQuotes from '../Quotes';

const { listMyTicketsMock, getProSummaryMock, downloadCsvMock, pushMock } = vi.hoisted(() => ({
  listMyTicketsMock: vi.fn(),
  getProSummaryMock: vi.fn(),
  downloadCsvMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../services/tickets', () => ({
  listMyTickets: listMyTicketsMock,
  getProSummary: getProSummaryMock,
  downloadProBillingCsv: downloadCsvMock,
}));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));

const renderPage = (page: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>
  );

const SUMMARY = {
  quotes: { toQuote: 2, awaitingApproval: 1, approved: 3, quotedTotal: 1000 },
  billing: { pendingCount: 2, pendingTotal: 550, releasedCount: 1, releasedTotal: 425.5 },
};

describe('Profesional: Facturación y Presupuestos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProSummaryMock.mockResolvedValue(SUMMARY);
    listMyTicketsMock.mockImplementation(async (_role: string, params: any) => ({
      items: params.status === 'closed'
        ? [{ _id: 't3', title: 'Enchufe', service: 'electricity', status: 'closed', quote: { amount: 400 }, extra: { amount: 25.5, status: 'approved' } }]
        : [{ _id: 't1', title: 'Grifo', service: 'plumbing', status: 'scheduled', quote: { amount: 200 }, extra: { amount: 40, status: 'pending' } }],
      total: 1,
      page: 1,
    }));
  });

  it('Facturación enseña las cifras del servidor, filtra por estado en el servidor y suma solo el extra aprobado', async () => {
    renderPage(<ProBilling />);
    expect(await screen.findByText('Grifo')).toBeInTheDocument();
    expect(listMyTicketsMock).toHaveBeenLastCalledWith('pro', expect.objectContaining({
      page: 1,
      status: 'awaiting_schedule,scheduled,in_progress,awaiting_validation,closed',
    }));
    expect(await screen.findByText('2 trabajos')).toBeInTheDocument();
    expect(screen.getByText('1 trabajo')).toBeInTheDocument();
    // El extra pendiente no cuenta: total = presupuesto.
    expect(screen.queryByText(/extra$/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Liberados/ }));
    expect(await screen.findByText('Enchufe')).toBeInTheDocument();
    expect(listMyTicketsMock).toHaveBeenLastCalledWith('pro', expect.objectContaining({ status: 'closed', page: 1 }));
    expect(screen.getByText(/\+ 25,50\s€ extra/)).toBeInTheDocument();
  });

  it('el CSV se descarga del servidor y avisa si falla', async () => {
    downloadCsvMock.mockRejectedValueOnce(new Error('500'));
    renderPage(<ProBilling />);
    const button = await screen.findByRole('button', { name: /Exportar CSV/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' })));
    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
  });

  it('Presupuestos empieza por lo que falta presupuestar y ofrece enviarlo', async () => {
    listMyTicketsMock.mockResolvedValue({
      items: [{ _id: 't0', title: 'Persiana', service: 'others', status: 'open' }],
      total: 1,
      page: 1,
    });
    renderPage(<ProQuotes />);
    expect(await screen.findByText('Persiana')).toBeInTheDocument();
    expect(screen.getByText('Enviar presupuesto')).toBeInTheDocument();
    expect(listMyTicketsMock).toHaveBeenLastCalledWith('pro', expect.objectContaining({ status: 'open', page: 1 }));
    expect(await screen.findByRole('button', { name: /Por presupuestar\s*2/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
