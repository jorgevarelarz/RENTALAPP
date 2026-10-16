import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsersPage from '../AdminUsersPage';

const { getMock, postMock, saveMock, blobErrorMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  saveMock: vi.fn(),
  blobErrorMock: vi.fn(),
}));

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  api: { get: getMock, post: postMock },
}));

vi.mock('../../../utils/download', () => ({ saveBlob: saveMock, blobErrorBody: blobErrorMock }));

const LIST = '/api/users';
const CSV = '/api/users/export.csv';

const users = [
  { id: 'u1', name: 'Laura Martín', email: 'laura@example.com', role: 'landlord', isVerified: true, createdAt: '2026-10-12T10:00:00.000Z' },
  { id: 'u2', name: 'Inmo Norte', email: 'inmo@example.com', role: 'agency', isVerified: false, companyName: 'Inmo Norte SL' },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>,
  );

describe('AdminUsersPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    saveMock.mockReset();
    blobErrorMock.mockReset();
    getMock.mockResolvedValue({ data: { items: users, total: 2, page: 1, limit: 25 } });
  });

  it('muestra nombre, rol en español e identidad', async () => {
    renderPage();
    const row = (await screen.findByText('laura@example.com')).closest('tr')!;
    expect(within(row).getByText('Laura Martín')).toBeInTheDocument();
    // Rol e identidad salen dos veces: en su columna y, para móvil, bajo el nombre
    expect(within(row).getAllByText('Propietario')).toHaveLength(2);
    expect(within(row).getAllByText('Verificada')).toHaveLength(2);
    const agency = screen.getByText('inmo@example.com').closest('tr')!;
    expect(within(agency).getAllByText('Agencia')).toHaveLength(2);
    expect(within(agency).getAllByText('Sin verificar')).toHaveLength(2);
    expect(within(agency).getByText('Inmo Norte SL')).toBeInTheDocument();
    expect(screen.getByText('2 cuentas')).toBeInTheDocument();
    expect(screen.queryByText(/Landlord|Tenant/)).not.toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(LIST, { params: { page: 1, limit: 25 } });
  });

  it('la búsqueda espera a que se deje de teclear y vuelve a la primera página', async () => {
    getMock.mockResolvedValue({ data: { items: users, total: 60, page: 1, limit: 25 } });
    renderPage();
    await screen.findByText('laura@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, { params: { page: 2, limit: 25 } }));

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'laura' } });
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, { params: { q: 'laura', page: 1, limit: 25 } }));
    expect(getMock).not.toHaveBeenCalledWith(LIST, { params: { q: 'l', page: 1, limit: 25 } });
  });

  it('un error al cargar se ve y se puede reintentar', async () => {
    getMock.mockRejectedValueOnce({ response: { status: 500, data: { error: 'boom' } } });
    renderPage();
    const alert = await screen.findByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('laura@example.com')).toBeInTheDocument();
  });

  it('el CSV lo pide al servidor con los filtros', async () => {
    getMock.mockImplementation((url: string) =>
      url === CSV ? Promise.resolve({ data: new Blob(['x']) }) : Promise.resolve({ data: { items: users, total: 2, page: 1, limit: 25 } }),
    );
    renderPage();
    await screen.findByText('laura@example.com');
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'agency' } });
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(expect.any(Blob), 'usuarios.csv'));
    expect(getMock).toHaveBeenCalledWith(CSV, { params: { role: 'agency' }, responseType: 'blob' });
  });

  it('crea una agencia desde el diálogo y explica el correo repetido', async () => {
    renderPage();
    await screen.findByText('laura@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva agencia' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Persona de contacto'), { target: { value: 'Ana' } });
    fireEvent.change(within(dialog).getByLabelText('Correo de la agencia'), { target: { value: 'ana@inmo.es' } });
    fireEvent.change(within(dialog).getByLabelText('Contraseña temporal'), { target: { value: 'temporal123' } });

    postMock.mockRejectedValueOnce({ response: { status: 409, data: { error: 'email_already_exists' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear agencia' }));
    expect(await within(dialog).findByText('Ya hay una cuenta con ese correo.')).toBeInTheDocument();

    postMock.mockResolvedValueOnce({ data: { user: { email: 'ana@inmo.es' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear agencia' }));
    expect(await screen.findByText(/Agencia creada: ana@inmo.es/)).toBeInTheDocument();
    expect(postMock).toHaveBeenLastCalledWith(LIST, {
      name: 'Ana',
      email: 'ana@inmo.es',
      password: 'temporal123',
      companyName: undefined,
      role: 'agency',
    });
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith(LIST, { params: { role: 'agency', page: 1, limit: 25 } }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
