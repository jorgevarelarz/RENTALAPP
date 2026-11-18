import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayoutAccountCard, { feeSentence } from '../PayoutAccountCard';

const { getPayoutStatus, createPayoutLink, pushMock } = vi.hoisted(() => ({
  getPayoutStatus: vi.fn(),
  createPayoutLink: vi.fn(),
  pushMock: vi.fn(),
}));
vi.mock('../../../services/connect', () => ({ getPayoutStatus, createPayoutLink }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));

const fees = { rentPct: 5, signPct: 2 };
const renderCard = (props: React.ComponentProps<typeof PayoutAccountCard>, url = '/landlord/payments') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PayoutAccountCard {...props} />
    </MemoryRouter>,
  );

describe('Cuenta de cobros', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dice las comisiones antes de conectar y abre el alta en Stripe', async () => {
    getPayoutStatus.mockResolvedValue({ connected: false, ready: false, fees });
    createPayoutLink.mockResolvedValue('https://connect.stripe.com/setup/x');
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });

    renderCard({ audience: 'landlord' });
    expect(await screen.findByRole('heading', { name: 'Activa tus cobros' })).toBeInTheDocument();
    expect(screen.getByText(/5 % de cada renta cobrada y 2 % de la primera renta/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar cuenta bancaria' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/x'));
  });

  it('con el alta a medias pide terminarla', async () => {
    getPayoutStatus.mockResolvedValue({ connected: true, ready: false, fees });
    renderCard({ audience: 'landlord' });
    expect(await screen.findByRole('heading', { name: 'Falta terminar el alta para poder cobrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar el alta' })).toBeInTheDocument();
  });

  it('con la cuenta activa lo dice y deja cambiar los datos', async () => {
    getPayoutStatus.mockResolvedValue({ connected: true, ready: true, payouts_enabled: true, fees });
    renderCard({ audience: 'landlord' });
    expect(await screen.findByText('Activa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar datos bancarios' })).toBeInTheDocument();
  });

  it('en el panel de agencia desaparece cuando la cuenta ya está lista', async () => {
    getPayoutStatus.mockResolvedValue({ connected: true, ready: true });
    const { container } = renderCard({ audience: 'agency', hideWhenReady: true }, '/agency');
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('si no se puede consultar el estado, ofrece reintentar sin códigos internos', async () => {
    getPayoutStatus.mockRejectedValueOnce({ response: { status: 502, data: { error: 'stripe_connect_failed' } } });
    renderCard({ audience: 'landlord' });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el estado de tu cuenta de cobros.');
    expect(screen.queryByText(/stripe_connect_failed/)).toBeNull();

    getPayoutStatus.mockResolvedValue({ connected: false, ready: false });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Activa tus cobros' })).toBeInTheDocument();
  });

  it('avisa al volver de Stripe y limpia la URL', async () => {
    getPayoutStatus.mockResolvedValue({ connected: true, ready: false });
    renderCard({ audience: 'landlord' }, '/landlord/payments?connect=retry');
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ tone: 'info' })));
  });

  it('feeSentence no dice nada si no hay comisiones', () => {
    expect(feeSentence(undefined)).toBe('');
    expect(feeSentence({ rentPct: 0, signPct: 0 })).toBe('');
    expect(feeSentence({ rentPct: 5, signPct: 0 })).toBe('RentalApp descuenta 5 % de cada renta cobrada. El resto llega íntegro a tu cuenta.');
  });
});
