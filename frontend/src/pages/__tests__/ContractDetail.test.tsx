import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock router param id
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: (global as any).__mockId || 'c1' })
}), { virtual: true });

// Mock AuthContext with configurable user
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => (global as any).__mockAuth || { token: 't', user: null }
}));

// Mock ToastContext to avoid provider
jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: jest.fn(), remove: jest.fn(), toasts: [] })
}));

// Avoid importing real axios (ESM) via api/client
jest.mock('axios', () => {
  const axiosMock: any = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() };
  axiosMock.create = jest.fn(() => axiosMock);
  return { __esModule: true, default: axiosMock };
}, { virtual: true });

// Stub ChatPanel to avoid deep imports
jest.mock('../../components/chat/ChatPanel', () => () => <div data-testid="chat" />);

// Mock services used by the page
jest.mock('../../api/contracts', () => ({
  __esModule: true,
  getContract: jest.fn(),
  sendToSignature: jest.fn(),
  downloadPdf: jest.fn(),
  payDeposit: jest.fn(),
  signContract: jest.fn(),
}));

import ContractDetail from '../ContractDetail';
import * as contracts from '../../api/contracts';

function setAuth(user: any) {
  (global as any).__mockAuth = { token: 't', user };
}

describe('ContractDetail', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).__mockAuth = { token: 't', user: null };
    (global as any).__mockId = 'c1';
  });

  test('Muestra “Enviar a firma” para landlord con status none', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as jest.Mock).mockResolvedValue({ id: 'c1', owner: { id: 'u1' }, signature: { status: 'none' } });

    render(<ContractDetail />);

    expect(await screen.findByRole('button', { name: /enviar a firma/i })).toBeInTheDocument();
  });

  test('Acción “Enviar a firma” cambia a sent y oculta el botón', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    // 1a carga: none → muestra botón
    (contracts.getContract as jest.Mock)
      .mockResolvedValueOnce({ id: 'c1', owner: { id: 'u1' }, signature: { status: 'none' } })
      // recarga tras enviar → sent
      .mockResolvedValueOnce({ id: 'c1', owner: { id: 'u1' }, signature: { status: 'sent' } });
    (contracts.sendToSignature as jest.Mock).mockResolvedValue({ status: 'sent' });

    render(<ContractDetail />);

    const sendBtn = await screen.findByRole('button', { name: /enviar a firma/i });
    await userEvent.click(sendBtn);

    await waitFor(() => expect(screen.getByText(/sent/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /enviar a firma/i })).toBeNull();
  });

  test('Muestra “Ver PDF firmado” cuando status completed y pdfUrl presente', async () => {
    setAuth({ _id: 'u2', role: 'tenant' });
    (contracts.getContract as jest.Mock).mockResolvedValue({ id: 'c1', tenant: 'u2', signature: { status: 'completed', pdfUrl: 'http://x/signed.pdf' } });

    render(<ContractDetail />);

    expect(await screen.findByRole('button', { name: /ver pdf firmado/i })).toBeInTheDocument();
  });

  test('Render defensivo: sin signature trata como none y no crashea', async () => {
    setAuth({ _id: 'u1', role: 'landlord' });
    (contracts.getContract as jest.Mock).mockResolvedValue({ id: 'c1', owner: { id: 'u1' } });

    render(<ContractDetail />);

    // Chip de estado NONE visible y botón disponible
    expect(await screen.findByText(/none/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar a firma/i })).toBeInTheDocument();
  });
});
