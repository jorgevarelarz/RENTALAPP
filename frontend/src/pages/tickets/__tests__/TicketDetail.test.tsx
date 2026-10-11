import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';
import TicketDetail from '../TicketDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as ticketService from '../../../services/tickets';
import * as proService from '../../../services/pros';
import * as appointmentService from '../../../services/appointments';

vi.mock('../../../services/tickets');
vi.mock('../../../services/pros');
vi.mock('../../../services/appointments');
vi.mock('../../../components/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel">Chat Mock</div>,
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'user1', role: (global as any).__TEST_ROLE__ || 'tenant', name: 'Test User', email: 'test@test.com' },
    token: 'token',
  }),
}));
vi.mock('../../../utils/notify', () => ({
  useNotify: () => ({ push: vi.fn() }),
}));

const mockTicket = {
  _id: 'ticket123',
  title: 'Fuga de agua',
  description: 'Hay una fuga en el baño principal',
  status: 'open',
  service: 'plumbing',
  propertyAddress: 'Calle Falsa 123',
  history: [],
  images: [],
};

const renderWithContext = (ui: React.ReactElement, role: string = 'tenant') => {
  (global as any).__TEST_ROLE__ = role;
  return render(
    <MemoryRouter initialEntries={['/tickets/ticket123']}>
      <Routes>
        <Route path="/tickets/:id" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('TicketDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (proService.searchPros as Mock).mockResolvedValue({ items: [] });
  });

  test('Muestra título, descripción, servicio en español y siguiente paso', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue(mockTicket);

    renderWithContext(<TicketDetail />);

    expect(screen.getByText(/Cargando detalles.../i)).toBeInTheDocument();

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();
    expect(screen.getByText('Hay una fuga en el baño principal')).toBeInTheDocument();
    expect(screen.getByText('Fontanería')).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(screen.getByText(/Tu arrendador está buscando un profesional/)).toBeInTheDocument();
  });

  test('PRO: Muestra formulario de presupuesto cuando está abierta', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({ ...mockTicket, status: 'open', proId: 'user1' });

    renderWithContext(<TicketDetail />, 'pro');

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('€')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar presupuesto/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Marcar trabajo terminado/i })).not.toBeInTheDocument();
  });

  test('LANDLORD: Muestra botón de aprobar cuando hay presupuesto', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({
      ...mockTicket,
      status: 'quoted',
      proId: 'pro1',
      pro: { id: 'pro1', displayName: 'Fontanería Pérez' },
      quote: { amount: 150, note: 'Reparación tubería' },
    });

    renderWithContext(<TicketDetail />, 'landlord');

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();
    expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Aprobar y pagar/i })).toBeInTheDocument();
  });

  test('LANDLORD: Puede asignar un profesional si está abierta', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({ ...mockTicket, status: 'open', pro: null });

    renderWithContext(<TicketDetail />, 'landlord');

    const searchButton = await screen.findByRole('button', { name: /Buscar profesional/i });

    userEvent.click(searchButton);

    await waitFor(() => expect(proService.searchPros).toHaveBeenCalled());
  });

  test('PRO: con el presupuesto pagado y la cita aceptada puede marcar el trabajo terminado', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({
      ...mockTicket,
      status: 'scheduled',
      proId: 'user1',
      escrowId: 'esc1',
      quote: { amount: 150 },
      appointment: { start: '2030-01-10T09:00:00.000Z', status: 'accepted' },
    });
    (ticketService.completeWork as Mock).mockResolvedValue({});

    renderWithContext(<TicketDetail />, 'pro');

    const complete = await screen.findByRole('button', { name: /Marcar trabajo terminado/i });
    expect(screen.queryByPlaceholderText('€')).not.toBeInTheDocument();
    userEvent.click(complete);
    await waitFor(() => expect(ticketService.completeWork).toHaveBeenCalledWith('ticket123'));
  });

  test('TENANT: acepta la cita propuesta por el profesional', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({
      ...mockTicket,
      status: 'awaiting_schedule',
      proId: 'pro1',
      escrowId: 'esc1',
      appointment: { start: '2030-01-10T09:00:00.000Z', status: 'proposed' },
    });

    renderWithContext(<TicketDetail />, 'tenant');

    expect(await screen.findByText(/Cita propuesta:/)).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: /Aceptar/i }));
    await waitFor(() => expect(appointmentService.acceptAppointment).toHaveBeenCalledWith('ticket123'));
  });

  test('LANDLORD: valida el trabajo terminado; ya no hay botón de cerrar sin endpoint', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({
      ...mockTicket,
      status: 'awaiting_validation',
      proId: 'pro1',
      escrowId: 'esc1',
      quote: { amount: 150 },
    });
    (ticketService.validateTicket as Mock).mockResolvedValue({});

    renderWithContext(<TicketDetail />, 'landlord');

    const validate = await screen.findByRole('button', { name: /Validar trabajo y liberar el pago/i });
    expect(screen.queryByRole('button', { name: /Cerrar incidencia/i })).not.toBeInTheDocument();
    userEvent.click(validate);
    await waitFor(() => expect(ticketService.validateTicket).toHaveBeenCalledWith('ticket123'));
  });
});
