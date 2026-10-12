import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
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
    expect(screen.queryByRole('list', { name: 'Fotos de la avería' })).not.toBeInTheDocument();
  });

  test('Muestra las fotos de la avería con enlace a cada una', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({ ...mockTicket, photos: ['/uploads/a1.jpg', '/uploads/b2.png'] });
    renderWithContext(<TicketDetail />);

    const gallery = await screen.findByRole('list', { name: 'Fotos de la avería' });
    const links = within(gallery).getAllByRole('link');
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/uploads/a1.jpg', '/uploads/b2.png']);
    expect(within(gallery).getByAltText('Foto 2 de la avería')).toBeInTheDocument();
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

  test('LANDLORD: busca profesional en la ciudad del inmueble, amplía a otras y asigna', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({ ...mockTicket, status: 'open', pro: null, propertyCity: 'Málaga' });
    (ticketService.assignPro as Mock).mockResolvedValue({});
    (proService.searchPros as Mock)
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [{ _id: 'p9', displayName: 'Fontanería Sur', city: 'Sevilla', services: [{ key: 'plumbing', basePrice: 40 }], ratingAvg: 4.5, reviewCount: 2 }],
      });

    renderWithContext(<TicketDetail />, 'landlord');

    await userEvent.click(await screen.findByRole('button', { name: /Buscar profesional/i }));
    expect(proService.searchPros).toHaveBeenCalledWith('Málaga', 'plumbing');
    expect(await screen.findByText('Nadie ofrece fontanería en Málaga todavía.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Buscar en todas las ciudades' }));
    expect(proService.searchPros).toHaveBeenLastCalledWith(undefined, 'plumbing');
    expect((await screen.findByText('Fontanería Sur')).closest('a')).toHaveAttribute('href', '/pros/p9');
    expect(screen.getByText(/Sevilla · desde 40,00\s€ · 4,5 de 5 \(2 opiniones\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    await waitFor(() => expect(ticketService.assignPro).toHaveBeenCalledWith('ticket123', 'p9'));
  });

  test('LANDLORD: el profesional asignado enlaza a su perfil público', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({
      ...mockTicket, status: 'open', proId: 'u9', pro: { id: 'u9', displayName: 'Fontanería Sur', profileId: 'p9' },
    });

    renderWithContext(<TicketDetail />, 'landlord');

    const links = await screen.findAllByRole('link', { name: 'Fontanería Sur' });
    expect(links[0]).toHaveAttribute('href', '/pros/p9');
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
