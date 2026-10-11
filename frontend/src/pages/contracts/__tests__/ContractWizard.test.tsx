import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContractWizard from '../ContractWizard';

const { createContractMock, getPropertyMock, pushMock } = vi.hoisted(() => ({
  createContractMock: vi.fn(),
  getPropertyMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../../services/contracts', () => ({ createContract: createContractMock }));
vi.mock('../../../services/properties', () => ({ getProperty: getPropertyMock }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));

const state = {
  propertyId: 'p1',
  tenantId: 't1',
  initialData: { address: 'Calle Mayor 1', city: 'Madrid', rentAmount: 950, tenantName: 'Ana Ruiz', tenantEmail: 'ana@example.com' },
};

function renderWizard(routeState: unknown = state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/contracts/new', state: routeState }]}>
      <Routes>
        <Route path="/contracts/new" element={<ContractWizard />} />
        <Route path="/contracts/:id" element={<p>Detalle del contrato</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const goToReview = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
  fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
  await screen.findByText('Inquilino');
};

describe('ContractWizard', () => {
  beforeEach(() => {
    createContractMock.mockReset();
    getPropertyMock.mockReset();
    pushMock.mockReset();
    getPropertyMock.mockResolvedValue({ _id: 'p1', owner: 'l1', region: 'Comunidad de Madrid', address: 'Calle Mayor 1', city: 'Madrid' });
  });

  it('sin candidato explica de dónde se crea el contrato', () => {
    renderWizard(null);
    expect(screen.getByText(/Los contratos se preparan a partir de un candidato/)).toBeTruthy();
    expect(getPropertyMock).not.toHaveBeenCalled();
  });

  it('crea el contrato con el dueño, la región del catálogo y las cláusulas, y abre el detalle', async () => {
    createContractMock.mockResolvedValue({ _id: 'c9' });
    renderWizard();
    await waitFor(() => expect(getPropertyMock).toHaveBeenCalledWith('p1'));
    await goToReview();
    expect(screen.getByText('Ana Ruiz')).toBeTruthy();
    await screen.findByText('En el Instituto de la Vivienda de Madrid (IVIMA)');
    fireEvent.click(screen.getByRole('button', { name: 'Crear contrato' }));
    await screen.findByText('Detalle del contrato');
    const payload = createContractMock.mock.calls[0][0];
    expect(payload).toMatchObject({ landlord: 'l1', tenant: 't1', property: 'p1', region: 'madrid', rent: 950, deposit: 950 });
    expect(payload.clauses.map((c: any) => c.id)).toContain('fianza_autonomica');
  });

  it('no deja crear el contrato si la comunidad no está soportada', async () => {
    getPropertyMock.mockResolvedValue({ _id: 'p1', owner: 'l1', region: 'Andalucía' });
    renderWizard();
    await screen.findByText(/Todavía no generamos contratos para inmuebles en «Andalucía»/);
    await goToReview();
    expect((screen.getByRole('button', { name: 'Crear contrato' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('muestra el error del backend en español', async () => {
    createContractMock.mockRejectedValue({ response: { data: { error: 'forbidden' } } });
    renderWizard();
    await waitFor(() => expect(getPropertyMock).toHaveBeenCalled());
    await goToReview();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Crear contrato' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Crear contrato' }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error', title: expect.stringMatching(/^Solo el propietario/) })),
    );
  });
});
