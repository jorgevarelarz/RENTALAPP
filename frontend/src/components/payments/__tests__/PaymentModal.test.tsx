import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { stripeKey: '' },
  confirmCardPayment: vi.fn(),
}));

vi.mock('../../../config/env', () => ({ appEnv: mocks.env }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardElement: () => <div data-testid="card" />,
  useStripe: () => ({ confirmCardPayment: mocks.confirmCardPayment }),
  useElements: () => ({ getElement: () => ({}) }),
}));

async function renderModal(stripeKey: string, props: Partial<React.ComponentProps<any>> = {}) {
  mocks.env.stripeKey = stripeKey;
  vi.resetModules();
  const { default: PaymentModal } = await import('../PaymentModal');
  const onSuccess = vi.fn();
  render(
    <PaymentModal open onClose={vi.fn()} amountEUR={850.5} onSuccess={onSuccess} title="Pagar renta" clientSecret="pi_secret" {...props} />,
  );
  return onSuccess;
}

afterEach(() => mocks.confirmCardPayment.mockReset());

describe('PaymentModal', () => {
  it('sin clave de Stripe explica que no se puede pagar, sin jerga de configuración', async () => {
    await renderModal('');
    const dialog = screen.getByRole('dialog', { name: 'Pagar renta' });
    expect(dialog).toHaveTextContent('Los pagos con tarjeta no están disponibles ahora mismo');
    expect(dialog).not.toHaveTextContent(/Error de Configuración/);
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument();
  });

  it('muestra concepto e importe en formato español y paga con el client secret', async () => {
    mocks.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    const onSuccess = await renderModal('pk_test_x', { description: 'Reparación: grifo' });
    const dialog = screen.getByRole('dialog', { name: 'Pagar renta' });
    expect(dialog).toHaveTextContent('Reparación: grifo');
    expect(dialog).toHaveTextContent(/850,50\s€/);
    fireEvent.click(screen.getByRole('button', { name: /Pagar 850,50\s€/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mocks.confirmCardPayment).toHaveBeenCalledWith('pi_secret', expect.anything());
  });

  it('un rechazo de la tarjeta se muestra como alerta y no completa el pago', async () => {
    mocks.confirmCardPayment.mockResolvedValue({ error: { message: 'Tu tarjeta ha sido rechazada.' } });
    const onSuccess = await renderModal('pk_test_x');
    fireEvent.click(screen.getByRole('button', { name: /Pagar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu tarjeta ha sido rechazada.');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
