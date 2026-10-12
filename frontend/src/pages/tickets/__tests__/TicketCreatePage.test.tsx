import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mock, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketCreatePage from '../TicketCreatePage';
import * as ticketService from '../../../services/tickets';
import * as contractService from '../../../services/contracts';

vi.mock('../../../services/tickets');
vi.mock('../../../services/contracts');
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'tenant1', role: 'tenant' }, token: 'token' }),
}));
const push = vi.fn();
vi.mock('../../../utils/notify', () => ({ useNotify: () => ({ push }) }));

const contract = (id: string, title: string) => ({
  _id: id,
  status: 'active',
  property: { _id: `p-${id}`, title, address: 'Calle Real 1', city: 'Madrid' },
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/tickets/new']}>
        <Routes>
          <Route path="/tickets/new" element={<TicketCreatePage />} />
          <Route path="/tickets/:id" element={<p>Ficha de la incidencia</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('TicketCreatePage', () => {
  beforeEach(() => vi.clearAllMocks());

  test('con un solo contrato activo lo da por elegido y envía la avería', async () => {
    (contractService.listContracts as Mock).mockResolvedValue({ items: [contract('c1', 'Piso en Chamberí')] });
    (ticketService.createTicket as Mock).mockResolvedValue({ _id: 't1' });
    renderPage();

    expect(await screen.findByText('Piso en Chamberí')).toBeInTheDocument();
    expect(screen.getByText('Calle Real 1, Madrid')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));
    await userEvent.type(screen.getByLabelText('Título'), '  No abre la puerta ');
    await userEvent.type(screen.getByLabelText('Qué pasa'), 'La llave no gira');
    await userEvent.click(screen.getByRole('button', { name: 'Comunicar avería' }));

    await waitFor(() =>
      expect(ticketService.createTicket).toHaveBeenCalledWith({
        contractId: 'c1',
        service: 'locksmith',
        title: 'No abre la puerta',
        description: 'La llave no gira',
      }),
    );
    expect(await screen.findByText('Ficha de la incidencia')).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith('success', expect.stringContaining('arrendador'));
  });

  test('pide elegir vivienda y tipo antes de enviar y traduce el error del backend', async () => {
    (contractService.listContracts as Mock).mockResolvedValue({
      items: [contract('c1', 'Piso en Chamberí'), contract('c2', 'Estudio en Gràcia')],
    });
    (ticketService.createTicket as Mock).mockRejectedValue({ response: { data: { error: 'contract_not_active' } } });
    renderPage();

    const select = await screen.findByRole('combobox');
    await userEvent.click(screen.getByRole('button', { name: 'Comunicar avería' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige la vivienda.');

    await userEvent.selectOptions(select, 'c2');
    await userEvent.click(screen.getByRole('button', { name: 'Comunicar avería' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige el tipo de avería.');
    expect(ticketService.createTicket).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Fontanería' }));
    await userEvent.type(screen.getByLabelText('Título'), 'Gotera');
    await userEvent.type(screen.getByLabelText('Qué pasa'), 'Cae agua');
    await userEvent.click(screen.getByRole('button', { name: 'Comunicar avería' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se pueden comunicar averías de un contrato activo.');
  });

  test('sube fotos, deja quitarlas y las manda con la avería; rechaza formatos no admitidos', async () => {
    (contractService.listContracts as Mock).mockResolvedValue({ items: [contract('c1', 'Piso en Chamberí')] });
    (ticketService.uploadTicketPhotos as Mock).mockResolvedValue(['/uploads/a1.jpg', '/uploads/b2.jpg']);
    (ticketService.createTicket as Mock).mockResolvedValue({ _id: 't1' });
    renderPage();

    const input = (await screen.findByText('Añadir fotos')).querySelector('input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'casa.heic', { type: 'image/heic' }), undefined, { applyAccept: false });
    expect(screen.getByRole('alert')).toHaveTextContent('Solo se admiten fotos JPG, PNG o WebP.');
    expect(ticketService.uploadTicketPhotos).not.toHaveBeenCalled();

    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    await userEvent.upload(input, files);
    expect(await screen.findByAltText('Foto 2 de la avería')).toBeInTheDocument();
    expect(ticketService.uploadTicketPhotos).toHaveBeenCalledWith(files);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar la foto 1' }));
    expect(screen.queryByAltText('Foto 2 de la avería')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Electricidad' }));
    await userEvent.type(screen.getByLabelText('Título'), 'Salta el diferencial');
    await userEvent.type(screen.getByLabelText('Qué pasa'), 'Al encender el horno');
    await userEvent.click(screen.getByRole('button', { name: 'Comunicar avería' }));
    await waitFor(() =>
      expect(ticketService.createTicket).toHaveBeenCalledWith(expect.objectContaining({ photos: ['/uploads/b2.jpg'] })),
    );
  });

  test('sin contrato activo explica por qué no se puede comunicar', async () => {
    (contractService.listContracts as Mock).mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('No tienes ningún alquiler activo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comunicar avería' })).not.toBeInTheDocument();
  });
});
