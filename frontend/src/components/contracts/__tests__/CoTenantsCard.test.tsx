import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CoTenantsCard from '../CoTenantsCard';

const { listMock, inviteMock, signMock, pushMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  inviteMock: vi.fn(),
  signMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));
vi.mock('../../../services/coTenants', () => ({
  listContractParties: listMock,
  inviteCoTenant: inviteMock,
  signAsCoTenant: signMock,
}));

const principal = { partyId: 'legacy:u1', role: 'TENANT', status: 'JOINED', email: 'ana@example.com', user: { id: 'u1', name: 'Ana' } };

describe('CoTenantsCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el inquilino principal invita y ve el estado de cada co-titular', async () => {
    listMock
      .mockResolvedValueOnce([principal])
      .mockResolvedValueOnce([principal, { partyId: 'p2', role: 'TENANT', status: 'INVITED', email: 'co@example.com' }]);
    inviteMock.mockResolvedValue({ ok: true, partyId: 'p2' });
    render(<CoTenantsCard contractId="c1" contractStatus="pending_signature" myUserId="u1" canInvite />);

    fireEvent.change(await screen.findByLabelText('Invitar a otra persona'), { target: { value: ' co@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByText('Invitación enviada')).toBeInTheDocument();
    expect(inviteMock).toHaveBeenCalledWith('c1', 'co@example.com');
    expect(pushMock).toHaveBeenCalledWith({ title: 'Invitación enviada a co@example.com', tone: 'success' });
    expect(screen.queryByRole('button', { name: 'Firmar como co-titular' })).toBeNull();
  });

  it('el co-titular que se unió firma desde la tarjeta', async () => {
    const onSigned = vi.fn();
    const mine = { partyId: 'p2', role: 'TENANT', status: 'JOINED', email: 'co@example.com', user: { id: 'u2', name: 'Carlos' } };
    listMock.mockResolvedValueOnce([principal, mine]).mockResolvedValueOnce([principal, { ...mine, status: 'SIGNED' }]);
    signMock.mockResolvedValue({ ok: true, contractStatus: 'pending_signature' });
    render(<CoTenantsCard contractId="c1" contractStatus="pending_signature" myUserId="u2" canInvite={false} onSigned={onSigned} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Firmar como co-titular' }));
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    expect(signMock).toHaveBeenCalledWith('c1', 'p2');
    expect(await screen.findByText('Firmado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Invitar a otra persona')).toBeNull();
  });

  it('no se muestra si no hay co-titulares ni se puede invitar', async () => {
    listMock.mockResolvedValue([principal]);
    const { container } = render(<CoTenantsCard contractId="c1" contractStatus="active" myUserId="u9" canInvite={false} />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
