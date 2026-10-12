import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { _id: 'u1', role: 'landlord' } }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), remove: vi.fn(), toasts: [] }),
}));

vi.mock('../../api/client', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../../api/client';
import Earnings, { lastSixMonths, monthLabel } from '../Earnings';

const now = new Date();
const thisMonth = `${now.getMonth() + 1}/${now.getFullYear()}`;

const get = api.get as unknown as ReturnType<typeof vi.fn>;

const renderPage = () => render(<MemoryRouter><Earnings /></MemoryRouter>);

describe('Earnings', () => {
  beforeEach(() => get.mockReset());

  it('muestra solo los datos del backend, sin cobros ni rentabilidad inventados', async () => {
    get.mockResolvedValueOnce({
      data: { totalEarnings: 2500, monthEarnings: 1250, totalTransactions: 2, chart: [{ label: thisMonth, amount: 1250 }] },
    });
    renderPage();

    expect(await screen.findByText('Total cobrado')).toBeInTheDocument();
    expect(screen.getByText(/2500,00\s€/)).toBeInTheDocument();
    expect(screen.getAllByText(/1250,00\s€/).length).toBeGreaterThan(0);
    expect(screen.getByText(monthLabel(thisMonth))).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByRole('link', { name: 'Ver cobros y recibos' })).toHaveAttribute('href', '/landlord/payments');
    expect(screen.queryByText(/850/)).not.toBeInTheDocument();
    expect(screen.queryByText(/5\.4|Rentabilidad|100% cobrado/)).not.toBeInTheDocument();
  });

  it('sin cobros explica cuándo aparecerán', async () => {
    get.mockResolvedValueOnce({ data: { totalEarnings: 0, monthEarnings: 0, totalTransactions: 0, chart: [] } });
    renderPage();
    expect(await screen.findByText(/los cobros aparecerán aquí/)).toBeInTheDocument();
  });

  it('si falla la carga lo dice y permite reintentar (antes enseñaba 0 € como si no hubiera cobros)', async () => {
    get.mockRejectedValueOnce(new Error('403'));
    get.mockResolvedValueOnce({ data: { totalEarnings: 100, monthEarnings: 0, totalTransactions: 1, chart: [] } });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se han podido cargar tus ingresos');
    expect(screen.queryByText('Total cobrado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Total cobrado')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('lastSixMonths rellena con 0 los meses sin cobros, también al cruzar de año', () => {
    const months = lastSixMonths([{ label: '12/2025', amount: 900 }, { label: '3/2026', amount: 950 }], new Date(2026, 2, 15));
    expect(months).toEqual([
      { label: '10/2025', amount: 0 },
      { label: '11/2025', amount: 0 },
      { label: '12/2025', amount: 900 },
      { label: '1/2026', amount: 0 },
      { label: '2/2026', amount: 0 },
      { label: '3/2026', amount: 950 },
    ]);
  });

  it('monthLabel convierte «m/aaaa» en mes corto en español', () => {
    expect(monthLabel('1/2026')).toBe('ene 2026');
    expect(monthLabel('raro')).toBe('raro');
  });
});
