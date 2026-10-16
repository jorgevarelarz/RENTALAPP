import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemEvents from '../SystemEvents';

const { fetchMock, exportMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), exportMock: vi.fn() }));

vi.mock('../../../api/systemEvents', () => ({
  fetchSystemEvents: fetchMock,
  exportSystemEventsCsv: exportMock,
}));

const events = {
  items: [
    {
      _id: 'e1',
      type: 'COMPLIANCE_RISK_CREATED',
      resourceType: 'contract',
      resourceId: '64f000000000000000abc123',
      payload: { complianceStatus: { status: 'risk' } },
      createdAt: '2026-10-12T10:00:00.000Z',
    },
    {
      _id: 'e2',
      type: 'ADMIN_RATE_LIMIT_HIT',
      resourceType: 'admin',
      resourceId: 'admin:1.2.3.4',
      payload: { requestId: 'req-42', path: '/api/admin/stats' },
      createdAt: '2026-10-12T11:00:00.000Z',
    },
  ],
  total: 30,
  page: 1,
  pageSize: 25,
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <SystemEvents />
    </MemoryRouter>,
  );

describe('SystemEvents', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    exportMock.mockReset();
    fetchMock.mockResolvedValue(events);
  });

  it('muestra los eventos en español y enlaza el contrato', async () => {
    renderPage();
    const risk = await screen.findByText('Renta en riesgo', { selector: '.ra-badge' });
    expect(risk).toHaveClass('ra-badge-warning');
    const row = risk.closest('tr')!;
    expect(within(row).getByText('Contrato')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: '64f000000000000000abc123' })).toHaveAttribute(
      'href',
      '/contracts/64f000000000000000abc123',
    );
    expect(screen.queryByText(/System Events|Resource|Created At/)).not.toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
  });

  it('ofrece todos los tipos de evento y filtra por ellos', async () => {
    renderPage();
    await screen.findByText('Renta en riesgo', { selector: '.ra-badge' });
    const select = screen.getByLabelText('Evento');
    expect(within(select).getByRole('option', { name: 'Precio por encima del límite' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Limpieza de eventos' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'LISTING_PRICE_LIMIT_EXCEEDED' } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'LISTING_PRICE_LIMIT_EXCEEDED', page: 1 })),
    );
    expect(within(screen.getByLabelText('Recurso')).getByRole('option', { name: 'Inmueble' })).toBeInTheDocument();
  });

  it('abre el detalle con los datos del evento', async () => {
    renderPage();
    const row = (await screen.findByText('Límite de peticiones', { selector: '.ra-badge' })).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Ver detalle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Límite de peticiones' });
    expect(within(dialog).getByText('ADMIN_RATE_LIMIT_HIT')).toBeInTheDocument();
    expect(within(dialog).getByText('req-42')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(within(dialog).getByText(/"path": "\/api\/admin\/stats"/)).toBeInTheDocument();
  });

  it('explica las fechas no válidas y distingue la lista vacía con filtros', async () => {
    fetchMock.mockRejectedValueOnce({ response: { status: 400, data: { error: 'invalid_date_range' } } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('«Desde» tiene que ser anterior a «Hasta»');

    fetchMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Todavía no hay eventos')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Recurso'), { target: { value: 'property' } });
    expect(await screen.findByText('Ningún evento coincide con los filtros')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() => expect(screen.getByLabelText('Recurso')).toHaveValue(''));
  });

  it('exporta el CSV con los filtros y lee el error dentro del Blob', async () => {
    exportMock.mockRejectedValue({
      response: { status: 400, data: new Blob([JSON.stringify({ error: 'invalid_date_range' })], { type: 'application/json' }) },
    });
    renderPage();
    await screen.findByText('Renta en riesgo', { selector: '.ra-badge' });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('«Desde» tiene que ser anterior a «Hasta»');
    expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ dateTo: '2026-10-12' }));
  });
});
