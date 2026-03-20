import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';
import TicketDetail from '../TicketDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as ticketService from '../../../services/tickets';
import * as proService from '../../../services/pros';

vi.mock('../../../services/tickets');
vi.mock('../../../services/pros');
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

  test('Muestra detalles básicos del ticket', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue(mockTicket);

    renderWithContext(<TicketDetail />);

    expect(screen.getByText(/Cargando detalles.../i)).toBeInTheDocument();

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();
    expect(await screen.findByText('Calle Falsa 123')).toBeInTheDocument();
    expect(await screen.findByText('Hay una fuga en el baño principal')).toBeInTheDocument();
  });

  test('PRO: Muestra formulario de cotización cuando está abierto', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({ ...mockTicket, status: 'open' });

    renderWithContext(<TicketDetail />, 'pro');

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();

    expect(screen.getByText(/Enviar Presupuesto/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('€')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar Cotización/i })).toBeInTheDocument();
  });

  test('LANDLORD: Muestra botón de aprobar cuando hay cotización', async () => {
    const quotedTicket = {
      ...mockTicket,
      status: 'quoted',
      quote: { amount: 150, note: 'Reparación tubería' },
    };
    (ticketService.getTicket as Mock).mockResolvedValue(quotedTicket);

    renderWithContext(<TicketDetail />, 'landlord');

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();

    expect(screen.getByText('150€')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aprobar y Pagar/i })).toBeInTheDocument();
  });

  test('LANDLORD: Puede asignar un profesional si está abierto', async () => {
    (ticketService.getTicket as Mock).mockResolvedValue({ ...mockTicket, status: 'open', pro: null });

    renderWithContext(<TicketDetail />, 'landlord');

    const searchButton = await screen.findByRole('button', { name: /Buscar Profesional/i });

    userEvent.click(searchButton);

    await waitFor(() => expect(proService.searchPros).toHaveBeenCalled());
  });
});
