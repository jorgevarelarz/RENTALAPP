import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminCompliancePage from '../AdminCompliancePage';

const { getMock, saveMock } = vi.hoisted(() => ({ getMock: vi.fn(), saveMock: vi.fn() }));

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  api: { get: getMock },
}));

vi.mock('../../../utils/download', () => ({ saveBlob: saveMock, blobErrorBody: vi.fn() }));

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

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

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
    getMock.mockResolvedValue({ data: { data: acceptances } });
  });

  it('muestra las aceptaciones en español, también la de cookies', async () => {
    renderPage();
    const row = (await screen.findByText('laura@example.com')).closest('tr')!;
    expect(within(row).getByText('Cookies')).toBeInTheDocument();
    expect(within(row).getByText('v1.0')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('/api/admin/policies/acceptances', { params: { activeOnly: true } });
    expect(within(screen.getByLabelText('Política')).getByRole('option', { name: 'Cookies' })).toBeInTheDocument();
    expect(screen.queryByText(/UserAgent|Audit Trails/)).not.toBeInTheDocument();
  });

  it('el CSV neutraliza fórmulas y escapa comas y comillas', async () => {
    renderPage();
    await screen.findByText('laura@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(saveMock).toHaveBeenCalledWith(expect.any(Blob), 'aceptaciones-politicas.csv');
    const csv = await readBlob(saveMock.mock.calls[0][0]);
    expect(csv.split('\n')[1]).toContain(`"'=HYPERLINK(""http://evil.example"",""clic"")"`);
  });

  it('lista vacía: ofrece ver versiones anteriores', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver también versiones anteriores' }));
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith('/api/admin/policies/acceptances', { params: {} }));
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
  });
});
