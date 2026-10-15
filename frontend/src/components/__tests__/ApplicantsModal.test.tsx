import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicantsModal from '../ApplicantsModal';

const { getApplicationsMock, proposeMock, acceptMock, pushMock } = vi.hoisted(() => ({
  getApplicationsMock: vi.fn(),
  proposeMock: vi.fn(),
  acceptMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../services/properties', () => ({ getPropertyApplications: getApplicationsMock }));
vi.mock('../../services/appointments', () => ({
  proposeApplicationVisit: proposeMock,
  acceptApplicationVisit: acceptMock,
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: pushMock }) }));

const property = { _id: 'p1', title: 'Piso en Chamberí', address: 'Calle Mayor 1', city: 'Madrid', price: 950, deposit: 950 };
const ana = {
  _id: 'a1',
  status: 'pending',
  createdAt: '2026-10-01T10:00:00Z',
  message: 'Me interesa',
  tenant: { _id: 't1', name: 'Ana Ruiz', email: 'ana@example.com', tenantPro: { status: 'verified' } },
};

function WizardProbe() {
  const location = useLocation();
  return <p>Asistente para {(location.state as any)?.tenantId}</p>;
}

function renderModal() {
  return render(
    <MemoryRouter initialEntries={['/landlord']}>
      <Routes>
        <Route path="/landlord" element={<ApplicantsModal property={property} isOpen onClose={() => {}} />} />
        <Route path="/contracts/new" element={<WizardProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ApplicantsModal', () => {
  beforeEach(() => {
    getApplicationsMock.mockReset();
    proposeMock.mockReset();
    acceptMock.mockReset();
    pushMock.mockReset();
  });

  it('si falla la carga no inventa candidatos y deja reintentar', async () => {
    getApplicationsMock.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({ items: [ana] });
    renderModal();
    await screen.findByText('No se pudieron cargar los candidatos.');
    expect(screen.queryByRole('button', { name: 'Crear contrato' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Ana Ruiz');
    expect(screen.getByText(/Solvencia verificada/)).toBeTruthy();
  });

  it('propone la visita con el instante en ISO (UTC) y avisa si el servidor la rechaza', async () => {
    getApplicationsMock.mockResolvedValue({ items: [ana] });
    proposeMock.mockRejectedValueOnce({ response: { data: { error: 'forbidden' } } });
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Proponer visita' }));
    fireEvent.change(screen.getByLabelText('Día y hora de la visita'), { target: { value: '2026-10-12T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    await waitFor(() => expect(proposeMock).toHaveBeenCalledTimes(1));
    expect(proposeMock).toHaveBeenCalledWith('a1', new Date('2026-10-12T10:00').toISOString());
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith({ title: 'Solo el propietario del inmueble o la agencia que lo gestiona pueden proponer visitas.', tone: 'error' }),
    );
    // El formulario sigue abierto para corregir
    expect(screen.getByLabelText('Día y hora de la visita')).toBeTruthy();
  });

  it('acepta la visita que propone el candidato y recarga la lista', async () => {
    getApplicationsMock
      .mockResolvedValueOnce({ items: [{ ...ana, status: 'proposed', proposedBy: 'tenant', proposedDate: '2026-10-12T08:00:00Z' }] })
      .mockResolvedValueOnce({ items: [{ ...ana, status: 'scheduled', visitDate: '2026-10-12T08:00:00Z' }] });
    acceptMock.mockResolvedValue({ ok: true });
    renderModal();
    await screen.findByText(/El candidato propone visita/);
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar visita' }));
    await screen.findByText(/^Visita el /);
    expect(acceptMock).toHaveBeenCalledWith('a1');
    expect(pushMock).toHaveBeenCalledWith({ title: 'Visita aceptada', tone: 'success' });
  });

  it('«Crear contrato» abre el asistente con el candidato', async () => {
    getApplicationsMock.mockResolvedValue([ana]);
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Crear contrato' }));
    await screen.findByText('Asistente para t1');
  });

  it('un cambio de fecha del candidato enseña la visita concertada y la nueva', async () => {
    getApplicationsMock.mockResolvedValueOnce({
      items: [{ ...ana, status: 'proposed', proposedBy: 'tenant', visitDate: '2030-03-20T16:30:00Z', proposedDate: '2030-03-22T09:00:00Z' }],
    });
    renderModal();
    expect(await screen.findByText(/El candidato propone cambiar la visita del 20 mar 2030, \d{1,2}:30 al 22 mar 2030, \d{1,2}:00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar visita' })).toBeInTheDocument();
  });
});
