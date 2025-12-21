import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketDetail from '../TicketDetail';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as ticketService from '../../../services/tickets';
import * as proService from '../../../services/pros';

jest.mock('../../../services/tickets');
jest.mock('../../../services/pros');
jest.mock('../../../components/ChatPanel', () => () => <div data-testid="chat-panel">Chat Mock</div>);
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'user1', role: (global as any).__TEST_ROLE__ || 'tenant', name: 'Test User', email: 'test@test.com' },
    token: 'token',
  }),
}));
jest.mock('../../../utils/notify', () => ({
  useNotify: () => ({ push: jest.fn() }),
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
    jest.clearAllMocks();
    (proService.searchPros as jest.Mock).mockResolvedValue({ items: [] });
  });

  test('Muestra detalles básicos del ticket', async () => {
    (ticketService.getTicket as jest.Mock).mockResolvedValue(mockTicket);

    renderWithContext(<TicketDetail />);

    expect(screen.getByText(/Cargando detalles.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Fuga de agua')).toBeInTheDocument();
      expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
      expect(screen.getByText('Hay una fuga en el baño principal')).toBeInTheDocument();
    });
  });

  test('PRO: Muestra formulario de cotización cuando está abierto', async () => {
    (ticketService.getTicket as jest.Mock).mockResolvedValue({ ...mockTicket, status: 'open' });

    renderWithContext(<TicketDetail />, 'pro');

    await waitFor(() => expect(screen.getByText('Fuga de agua')).toBeInTheDocument());

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
    (ticketService.getTicket as jest.Mock).mockResolvedValue(quotedTicket);

    renderWithContext(<TicketDetail />, 'landlord');

    await waitFor(() => expect(screen.getByText('Fuga de agua')).toBeInTheDocument());

    expect(screen.getByText('150€')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aprobar y Pagar/i })).toBeInTheDocument();
  });

  test('LANDLORD: Puede asignar un profesional si está abierto', async () => {
    (ticketService.getTicket as jest.Mock).mockResolvedValue({ ...mockTicket, status: 'open', pro: null });

    renderWithContext(<TicketDetail />, 'landlord');

    await waitFor(() => expect(screen.getByRole('button', { name: /Buscar Profesional/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Buscar Profesional/i }));

    expect(proService.searchPros).toHaveBeenCalled();
  });
});
