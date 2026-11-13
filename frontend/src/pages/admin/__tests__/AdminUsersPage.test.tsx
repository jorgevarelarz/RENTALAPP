import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsersPage from '../AdminUsersPage';

const { getMock, postMock, patchMock, saveMock, blobErrorMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  saveMock: vi.fn(),
  blobErrorMock: vi.fn(),
}));

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  api: { get: getMock, post: postMock, patch: patchMock },
}));

vi.mock('../../../utils/download', () => ({ saveBlob: saveMock, blobErrorBody: blobErrorMock }));

const LIST = '/api/users';
const CSV = '/api/users/export.csv';

const users = [
  { id: 'u1', name: 'Laura Martín', email: 'laura@example.com', role: 'landlord', isVerified: true, createdAt: '2026-10-12T10:00:00.000Z' },
  { id: 'u2', name: 'Inmo Norte', email: 'inmo@example.com', role: 'agency', isVerified: false, companyName: 'Inmo Norte SL' },
  { id: 'u3', name: 'Admin', email: 'admin@example.com', role: 'admin', isVerified: true },
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
    patchMock.mockReset();
    saveMock.mockReset();
    blobErrorMock.mockReset();
    getMock.mockResolvedValue({ data: { items: users, total: 3, page: 1, limit: 25 } });
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
    expect(screen.getByText('3 cuentas')).toBeInTheDocument();
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
      url === CSV ? Promise.resolve({ data: new Blob(['x']) }) : Promise.resolve({ data: { items: users, total: 3, page: 1, limit: 25 } }),
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

  it('edita una cuenta desde su ficha y envía solo lo que cambia', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar la cuenta de Inmo Norte' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Correo'), { target: { value: 'Laura@Example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Rol'), { target: { value: 'landlord' } });
    fireEvent.click(within(dialog).getByLabelText(/Identidad verificada/));
    patchMock.mockRejectedValueOnce({ response: { status: 409, data: { error: 'email_already_exists' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(dialog).findByText('Ya hay otra cuenta con ese correo.')).toBeInTheDocument();
    expect(patchMock).toHaveBeenLastCalledWith('/api/users/u2', { email: 'Laura@Example.com', role: 'landlord', isVerified: true });

    fireEvent.change(within(dialog).getByLabelText('Correo'), { target: { value: 'inmo@example.com' } });
    patchMock.mockResolvedValueOnce({
      data: { id: 'u2', name: 'Inmo Norte', email: 'inmo@example.com', role: 'landlord', isVerified: true, companyName: 'Inmo Norte SL' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cuenta guardada: inmo@example.com.')).toBeInTheDocument();
    expect(patchMock).toHaveBeenLastCalledWith('/api/users/u2', { role: 'landlord', isVerified: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const row = screen.getByText('inmo@example.com').closest('tr')!;
    expect(within(row).getAllByText('Propietario')).toHaveLength(2);
    expect(within(row).getAllByText('Verificada')).toHaveLength(2);
  });

  it('el rol de un administrador no se puede cambiar desde la ficha', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar la cuenta de Admin' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('Rol')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Las cuentas de administración e institución no cambian de rol.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Admin RentalApp' } });
    patchMock.mockResolvedValueOnce({ data: { ...users[2], name: 'Admin RentalApp' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/api/users/u3', { name: 'Admin RentalApp' }));
    expect(await screen.findByText('Admin RentalApp')).toBeInTheDocument();
  });
});
