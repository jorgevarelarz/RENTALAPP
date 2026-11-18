import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminCompliancePage from '../AdminCompliancePage';

const { getMock, saveMock, blobErrorMock } = vi.hoisted(() => ({ getMock: vi.fn(), saveMock: vi.fn(), blobErrorMock: vi.fn() }));

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  api: { get: getMock },
}));

vi.mock('../../../utils/download', () => ({ saveBlob: saveMock, blobErrorBody: blobErrorMock }));

const acceptances = [
  {
    user: { id: '507f1f77bcf86cd799439010', email: 'laura@example.com' },
    policyType: 'cookies_policy',
    policyVersion: 'v1.0',
    acceptedAt: '2026-10-12T10:00:00.000Z',
    ip: '127.0.0.1',
    userAgent: '=HYPERLINK("http://evil.example","clic")',
  },
];

const LIST = '/api/admin/policies/acceptances';
const CSV = '/api/admin/policies/acceptances/export.csv';

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...acceptances[0], user: { id: `507f1f77bcf86cd7994390${String(i).padStart(2, '0')}`, email: `u${i}@example.com` } }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminCompliancePage />
    </MemoryRouter>,
  );

describe('AdminCompliancePage', () => {
  beforeEach(() => {
    getMock.mockReset();
    saveMock.mockReset();
    blobErrorMock.mockReset();
    getMock.mockResolvedValue({ data: { data: acceptances, total: 1, page: 1, pageSize: 25 } });
  });

  it('muestra las aceptaciones en español, también la de cookies', async () => {
    renderPage();
    const row = (await screen.findByText('laura@example.com')).closest('tr')!;
    expect(within(row).getByText('Cookies')).toBeInTheDocument();
    expect(within(row).getByText('v1.0')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(LIST, { params: { activeOnly: true, page: 1, pageSize: 25 } });
    expect(within(screen.getByLabelText('Política')).getByRole('option', { name: 'Cookies' })).toBeInTheDocument();
    expect(screen.queryByText(/UserAgent|Audit Trails/)).not.toBeInTheDocument();
  });

  it('el CSV lo pide al servidor con los filtros, no solo la página visible', async () => {
    renderPage();
    await screen.findByText('laura@example.com');
    fireEvent.change(screen.getByLabelText('Política'), { target: { value: 'cookies_policy' } });
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, expect.anything()));
    const blob = new Blob(['csv']);
    getMock.mockResolvedValueOnce({ data: blob });
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(blob, 'aceptaciones-politicas.csv'));
    expect(getMock).toHaveBeenCalledWith(CSV, { params: { policyType: 'cookies_policy', activeOnly: true }, responseType: 'blob' });
  });

  it('si el CSV falla, explica el error que viene dentro del Blob', async () => {
    renderPage();
    await screen.findByText('laura@example.com');
    getMock.mockRejectedValueOnce(new Error('400'));
    blobErrorMock.mockResolvedValueOnce({ error: 'invalid_policy_type' });
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(await screen.findByText('Esa política no existe.')).toBeInTheDocument();
  });

  it('pagina con el total del servidor y vuelve a la primera al cambiar el filtro', async () => {
    getMock.mockResolvedValue({ data: { data: many(25), total: 60, page: 1, pageSize: 25 } });
    renderPage();
    expect(await screen.findByText('1–25 de 60 aceptaciones')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, { params: { activeOnly: true, page: 2, pageSize: 25 } }));
    expect(await screen.findByText('26–50 de 60 aceptaciones')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Solo versiones vigentes'));
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, { params: { page: 1, pageSize: 25 } }));
  });

  it('lista vacía: ofrece ver versiones anteriores', async () => {
    getMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, pageSize: 25 } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver también versiones anteriores' }));
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, { params: { page: 1, pageSize: 25 } }));
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
  });
});
