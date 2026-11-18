import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProDashboard from '../../ProDashboard';
import ProProfilePage from '../Profile';

const { getProSummaryMock, getMyProMock, saveProMock, pushMock } = vi.hoisted(() => ({
  getProSummaryMock: vi.fn(),
  getMyProMock: vi.fn(),
  saveProMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../services/tickets', () => ({ getProSummary: getProSummaryMock, listMyTickets: vi.fn() }));
vi.mock('../../../services/pro', () => ({ getMyProProfile: getMyProMock, saveProProfile: saveProMock }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1', name: 'Lucía Pérez', role: 'pro' } }) }));

const renderPage = (page: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>
  );

const SUMMARY = {
  quotes: { toQuote: 2, awaitingApproval: 1, approved: 3, quotedTotal: 1000 },
  billing: { pendingCount: 2, pendingTotal: 550, releasedCount: 1, releasedTotal: 425.5 },
  work: { toSchedule: 0, inProgress: 1, awaitingValidation: 1 },
};

describe('Profesional: inicio y perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProSummaryMock.mockResolvedValue(SUMMARY);
  });

  it('el inicio enseña lo que le toca con enlaces, lo que espera de otros y pide crear el perfil si no existe', async () => {
    getMyProMock.mockResolvedValue(null);
    renderPage(<ProDashboard />);
    expect(screen.getByRole('heading', { name: 'Hola, Lucía' })).toBeInTheDocument();
    expect((await screen.findByText('Por presupuestar')).closest('a')).toHaveAttribute('href', '/pro/quotes');
    expect(screen.getByText('En curso').closest('a')).toHaveAttribute('href', '/pro/tickets?status=scheduled');
    // Sin trabajos por agendar, no sale la fila.
    expect(screen.queryByText('Por agendar')).toBeNull();
    expect(screen.getByText('Pendiente del propietario: aprobar 1 presupuesto · validar 1 trabajo terminado.')).toBeInTheDocument();
    expect(screen.getByText('2 trabajos')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Crear perfil' })).toHaveAttribute('href', '/pro/profile');
  });

  it('con el perfil creado, el inicio lo resume en español', async () => {
    getMyProMock.mockResolvedValue({ _id: 'p1', displayName: 'Reformas García', city: 'Madrid', active: true, services: [{ key: 'plumbing' }, { key: 'painting' }] });
    renderPage(<ProDashboard />);
    expect(await screen.findByText('Reformas García')).toBeInTheDocument();
    expect(screen.getByText('Madrid · Fontanería, Pintura')).toBeInTheDocument();
    expect(screen.getByText('Visible para propietarios')).toBeInTheDocument();
  });

  it('el perfil valida antes de enviar y guarda servicios con precio orientativo', async () => {
    getMyProMock.mockResolvedValue(null);
    saveProMock.mockImplementation(async (data: any) => ({ _id: 'p1', ...data }));
    renderPage(<ProProfilePage />);
    const name = await screen.findByLabelText('Nombre comercial');
    fireEvent.change(name, { target: { value: 'Reformas García' } });
    fireEvent.change(screen.getByLabelText('Ciudad donde trabajas'), { target: { value: 'Madrid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear perfil' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige al menos un servicio.');
    expect(saveProMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Fontanería'));
    fireEvent.change(screen.getByLabelText('Precio orientativo de fontanería (€)'), { target: { value: '45,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear perfil' }));
    await waitFor(() => expect(saveProMock).toHaveBeenCalledWith(
      { displayName: 'Reformas García', city: 'Madrid', services: [{ key: 'plumbing', basePrice: 45.5 }], active: true },
      expect.anything(),
    ));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' })));
  });

  it('el perfil traduce el error del servidor', async () => {
    getMyProMock.mockResolvedValue({ _id: 'p1', displayName: 'Reformas', city: 'Madrid', active: false, services: [{ key: 'cleaning', basePrice: 20 }] });
    saveProMock.mockRejectedValue({ response: { status: 400, data: { error: 'invalid_city' } } });
    renderPage(<ProProfilePage />);
    expect(await screen.findByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByLabelText(/Visible para propietarios/)).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La ciudad debe tener entre 2 y 60 caracteres.');
  });
});
