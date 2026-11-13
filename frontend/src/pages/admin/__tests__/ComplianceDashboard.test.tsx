import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ComplianceDashboard from '../ComplianceDashboard';

const { fetchMock, exportMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  exportMock: vi.fn(),
}));

vi.mock('../../../api/adminCompliance', () => ({
  fetchComplianceDashboard: fetchMock,
  exportComplianceDashboardCsv: exportMock,
}));

const dashboard = {
  totals: { evaluated: 30, risk: 4, compliant: 24, nonCompliant: 2 },
  lastUpdated: '2026-10-01T10:00:00.000Z',
  byArea: [
    { areaKey: 'galicia|oleiros|', total: 20, risk: 3 },
    { areaKey: 'madrid|madrid|centro', total: 10, risk: 1 },
  ],
  items: [
    {
      contractId: '64f000000000000000abc123',
      propertyId: 'p1',
      propertyAddress: 'Avenida del Faro 12',
      propertyCity: 'Oleiros',
      propertyRegion: 'galicia',
      previousRent: 900,
      newRent: 1000,
      status: 'risk',
      severity: 'warning',
      checkedAt: '2026-10-01T10:00:00.000Z',
      areaKey: 'galicia|oleiros|',
    },
  ],
  page: 1,
  pageSize: 25,
  total: 30,
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ComplianceDashboard />
    </MemoryRouter>,
  );

describe('ComplianceDashboard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    exportMock.mockReset();
    fetchMock.mockResolvedValue(dashboard);
  });

  it('muestra los totales del servidor y la fila en español', async () => {
    renderPage();
    expect(await screen.findByText('Avenida del Faro 12')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Resumen' });
    // «Cumplen» e «Incumplen» salen de los totales globales, no de las filas de la página
    expect(within(summary).getByText('Cumplen').nextSibling).toHaveTextContent('24');
    expect(within(summary).getByText('Incumplen').nextSibling).toHaveTextContent('2');

    const row = screen.getByText('Avenida del Faro 12').closest('tr')!;
    expect(within(row).getByText('En riesgo')).toHaveClass('ra-badge-warning');
    expect(within(row).getByText('Aviso')).toHaveClass('ra-badge-warning');
    expect(within(row).getByText(/900\s€ → 1\.?000\s€/)).toBeInTheDocument();
    expect(within(row).getByText(/\+11,1 %/)).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: /Contrato …abc123/ })).toHaveAttribute(
      'href',
      '/contracts/64f000000000000000abc123',
    );
    expect(screen.queryByText(/Compliant|Non-compliant|Risk/)).not.toBeInTheDocument();
  });

  it('ofrece las zonas como desplegable y filtra por ellas', async () => {
    renderPage();
    await screen.findByText('Avenida del Faro 12');

    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: 'madrid|madrid|centro' } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ areaKey: 'madrid|madrid|centro', page: 1 })),
    );
    expect(screen.getByRole('option', { name: 'madrid · madrid · centro' })).toBeInTheDocument();
  });

  it('pagina con el total del servidor', async () => {
    renderPage();
    await screen.findByText('Avenida del Faro 12');
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it('explica un rango de fechas no válido', async () => {
    fetchMock.mockRejectedValue({ response: { status: 400, data: { error: 'invalid_date_range' } } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('«Desde» tiene que ser anterior a «Hasta»');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('distingue lista vacía con filtros y deja quitarlos', async () => {
    fetchMock.mockResolvedValue({ ...dashboard, items: [], total: 0, totals: { evaluated: 0, risk: 0, compliant: 0, nonCompliant: 0 } });
    renderPage();
    expect(await screen.findByText('Todavía no hay contratos revisados')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'non_compliant' } });
    expect(await screen.findByText('Ningún contrato coincide con los filtros')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveValue(''));
  });

  it('lee el error del CSV dentro del Blob', async () => {
    exportMock.mockRejectedValue({
      response: { status: 400, data: new Blob([JSON.stringify({ error: 'invalid_date_range' })], { type: 'application/json' }) },
    });
    renderPage();
    await screen.findByText('Avenida del Faro 12');
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('«Desde» tiene que ser anterior a «Hasta»');
  });
});
