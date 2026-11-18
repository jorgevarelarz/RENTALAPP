import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminTenantProPage from '../AdminTenantProPage';

const { listMock, decideMock, purgeMock, fetchDocMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  decideMock: vi.fn(),
  purgeMock: vi.fn(),
  fetchDocMock: vi.fn(),
}));

vi.mock('../../../services/tenantPro', () => ({
  listPendingTenantPro: listMock,
  decideTenantPro: decideMock,
  purgeTenantPro: purgeMock,
  fetchTenantProDoc: fetchDocMock,
}));

const laura = {
  _id: '507f1f77bcf86cd799439010',
  name: 'Laura Martín',
  email: 'laura@example.com',
  createdAt: '2026-09-01T10:00:00.000Z',
  tenantPro: {
    status: 'pending',
    consentAccepted: true,
    docs: [
      { _id: 'd1', type: 'nomina', status: 'pending', uploadedAt: '2026-10-10T10:00:00.000Z', available: true },
      { _id: 'd2', type: 'renta', status: 'pending', uploadedAt: '2026-01-10T10:00:00.000Z', available: false },
    ],
  },
};
const pedro = { ...laura, _id: '507f1f77bcf86cd799439011', name: 'Pedro Gil', email: 'pedro@example.com' };

const apiError = (error: string, status = 400) => Object.assign(new Error(error), { response: { status, data: { error } } });

describe('AdminTenantProPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([laura, pedro]);
    decideMock.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (URL as any).createObjectURL = vi.fn(() => 'blob:doc');
    (URL as any).revokeObjectURL = vi.fn();
  });

  it('muestra cada solicitud con sus documentos en español y los eliminados sin enlace', async () => {
    render(<AdminTenantProPage />);
    const card = (await screen.findByRole('heading', { name: 'Laura Martín' })).closest('li')!;
    expect(within(card).getByText('Nómina')).toBeInTheDocument();
    expect(within(card).getByText('Declaración de la renta')).toBeInTheDocument();
    expect(within(card).getByText('Eliminado')).toBeInTheDocument();
    expect(within(card).getAllByRole('button', { name: /^Abrir/ })).toHaveLength(1);
    expect(screen.getByText(/2 solicitudes pendientes/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar por nombre o correo'), { target: { value: 'pedro' } });
    expect(screen.queryByRole('heading', { name: 'Laura Martín' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pedro Gil' })).toBeInTheDocument();
  });

  it('no aprueba sin renta máxima y aprueba con la cifra indicada', async () => {
    render(<AdminTenantProPage />);
    const card = (await screen.findByRole('heading', { name: 'Laura Martín' })).closest('li')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Aprobar' }));
    expect(within(card).getByRole('alert')).toHaveTextContent('Indica la renta máxima validada');
    expect(decideMock).not.toHaveBeenCalled();

    fireEvent.change(within(card).getByLabelText('Renta máxima validada'), { target: { value: '1450' } });
    listMock.mockResolvedValue([pedro]);
    fireEvent.click(within(card).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(decideMock).toHaveBeenCalledWith(laura._id, 'approved', 1450));
    expect(await screen.findByRole('status')).toHaveTextContent(/Laura Martín aprobada con una renta máxima de 1450 €\/mes/);
    expect(screen.queryByRole('heading', { name: 'Laura Martín' })).not.toBeInTheDocument();
  });

  it('pide confirmación al rechazar y explica una solicitud ya resuelta', async () => {
    render(<AdminTenantProPage />);
    const card = (await screen.findByRole('heading', { name: 'Laura Martín' })).closest('li')!;
    decideMock.mockRejectedValueOnce(apiError('not_pending', 409));
    fireEvent.click(within(card).getByRole('button', { name: 'Rechazar' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Laura Martín'));
    await waitFor(() => expect(decideMock).toHaveBeenCalledWith(laura._id, 'rejected', undefined));
    expect(await within(card).findByRole('alert')).toHaveTextContent('Esta solicitud ya estaba resuelta');
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('abre el documento en una ventana con vista previa; si se purgó, lo explica', async () => {
    fetchDocMock.mockResolvedValueOnce(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    render(<AdminTenantProPage />);
    const card = (await screen.findByRole('heading', { name: 'Laura Martín' })).closest('li')!;
    fireEvent.click(within(card).getByRole('button', { name: /^Abrir/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Nómina · Laura Martín' });
    expect(await within(dialog).findByTitle('Nómina de Laura Martín')).toHaveAttribute('src', 'blob:doc');
    expect(fetchDocMock).toHaveBeenCalledWith(laura._id, 'd1');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:doc');

    const blobErr = Object.assign(new Error('gone'), {
      response: { status: 410, data: new Blob([JSON.stringify({ error: 'doc_purged' })], { type: 'application/json' }) },
    });
    fetchDocMock.mockRejectedValueOnce(blobErr);
    fireEvent.click(within(card).getByRole('button', { name: /^Abrir/ }));
    expect(await screen.findByText(/Este documento ya se eliminó/)).toBeInTheDocument();
  });

  it('error al cargar con Reintentar y lista vacía', async () => {
    listMock.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce([]);
    render(<AdminTenantProPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay solicitudes pendientes')).toBeInTheDocument();
  });
});
