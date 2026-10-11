import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgencyLandlords from '../AgencyLandlords';

const { listMock, createMock, resendMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  resendMock: vi.fn(),
}));

vi.mock('../../../services/agency', () => ({
  listLandlordInvites: listMock,
  createLandlordInvite: createMock,
  resendLandlordInvite: resendMock,
}));

const steps = { accountCreated: false, kycVerified: false, hasProperty: false, hasActiveContract: false };
const pending = {
  id: 'i1',
  landlordName: 'Paco Prop',
  landlordEmail: 'paco@example.com',
  status: 'invited',
  createdAt: '2026-10-11T10:00:00Z',
  steps,
};

describe('AgencyLandlords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('avisa si el correo de la invitación no salió', async () => {
    listMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...pending, emailFailed: true }]);
    createMock.mockResolvedValue({ id: 'i1', landlordEmail: 'paco@example.com', status: 'invited', expiresAt: '', emailStatus: 'failed' });
    render(<AgencyLandlords />);

    fireEvent.click(await screen.findByRole('button', { name: /Dar de alta propietario/ }));
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Paco Prop' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'paco@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Invitación guardada, pero el correo a paco@example.com no salió');
    expect(await screen.findByText('No se pudo enviar el correo')).toBeInTheDocument();
  });

  it('reenvía una invitación pendiente desde la lista', async () => {
    listMock.mockResolvedValue([{ ...pending, status: 'expired' }]);
    resendMock.mockResolvedValue({ id: 'i1', landlordEmail: 'paco@example.com', status: 'invited', expiresAt: '', emailStatus: 'sent' });
    render(<AgencyLandlords />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar invitación a paco@example.com' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Invitación reenviada a paco@example.com');
    expect(resendMock).toHaveBeenCalledWith('i1');
  });

  it('explica por qué no se puede reenviar y no ofrece reenviar a quien ya activó su cuenta', async () => {
    listMock.mockResolvedValue([pending, { ...pending, id: 'i2', landlordEmail: 'ana@example.com', status: 'accepted' }]);
    resendMock.mockRejectedValue({ response: { data: { error: 'resend_too_soon' } } });
    render(<AgencyLandlords />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar invitación a paco@example.com' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ya se envió hace poco. Podrás reenviarla dentro de unos minutos.'),
    );
    expect(screen.queryByRole('button', { name: 'Reenviar invitación a ana@example.com' })).toBeNull();
  });
});
