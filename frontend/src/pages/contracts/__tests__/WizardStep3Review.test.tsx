import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WizardStep3Review from '../WizardStep3Review';

const { createContractMock, pushMock } = vi.hoisted(() => ({
  createContractMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../services/contracts', () => ({ createContract: createContractMock }));
vi.mock('../../../services/notify', () => ({ sendEmail: vi.fn() }));
vi.mock('../../../utils/notify', () => ({ useNotify: () => ({ push: pushMock }) }));

const basics = { landlord: 'l1', tenant: 't1', property: 'p1', region: 'galicia', rent: 750, deposit: 750 };

describe('WizardStep3Review', () => {
  beforeEach(() => {
    createContractMock.mockReset();
    pushMock.mockReset();
  });

  it('explica en español por qué no se pudo crear el contrato', async () => {
    createContractMock.mockRejectedValue({ response: { data: { error: 'landlord_not_owner' } } });
    render(<WizardStep3Review basics={basics} clauses={{}} onBack={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear contrato' }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('error', 'El arrendador tiene que ser el propietario del inmueble.'),
    );
  });

  it('con un error desconocido muestra el que llega', async () => {
    createContractMock.mockRejectedValue({ response: { data: { error: 'Otro problema' } } });
    render(<WizardStep3Review basics={basics} clauses={{}} onBack={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear contrato' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('error', 'Otro problema'));
  });
});
