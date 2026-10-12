import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyFormRHF from '../PropertyFormRHF';

const push = vi.fn();
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push }) }));
vi.mock('../../services/ai', () => ({ generateDescription: vi.fn() }));
vi.mock('../RentSuggestionCard', () => ({ default: () => null }));

const filled = {
  title: 'Ático luminoso en el centro',
  address: 'Calle Mayor, 10',
  city: 'Madrid',
  region: 'Comunidad de Madrid',
};

function renderForm(defaultValues: any = {}) {
  const onSubmit = vi.fn();
  render(<PropertyFormRHF onSubmit={onSubmit} onUploadPhotos={vi.fn()} defaultValues={defaultValues} />);
  return { onSubmit };
}

describe('PropertyFormRHF', () => {
  beforeEach(() => {
    push.mockReset();
    // Sin red: la búsqueda de direcciones no devuelve nada
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => [] })));
  });

  it('asocia las etiquetas a sus campos y marca el error del título', async () => {
    renderForm();
    expect(screen.getByLabelText('Dirección completa')).toHaveClass('ra-input');
    expect(screen.getByLabelText('Ciudad')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitud')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    const title = screen.getByLabelText('Título del anuncio');
    await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'));
    const errorId = title.getAttribute('aria-describedby') as string;
    expect(document.getElementById(errorId)).toHaveTextContent(/al menos 5 caracteres/);
  });

  it('enseña el error del tamaño en vez de quedarse parado en «Detalles»', async () => {
    renderForm({ ...filled, sizeM2: 5 });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    const size = await screen.findByLabelText('Tamaño');
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(size).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText(/tamaño mínimo es 10 m²/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Detalles');
  });

  it('Intro en un campo avanza de paso y no envía el anuncio', async () => {
    const { onSubmit } = renderForm(filled);
    fireEvent.submit(screen.getByLabelText('Título del anuncio').closest('form') as HTMLFormElement);
    expect(await screen.findByLabelText('Habitaciones')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('el botón de quitar foto tiene nombre y quita la foto', async () => {
    const images = ['https://x.test/1.jpg', 'https://x.test/2.jpg'];
    renderForm({ ...filled, images });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByLabelText('Habitaciones');
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    userEvent.click(await screen.findByRole('button', { name: 'Quitar la foto 1' }));
    expect(screen.queryByAltText('Foto 2')).toBeNull();
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', images[1]);
    expect(screen.getByText('Faltan 2 fotos para publicar')).toBeInTheDocument();
  });

  it('la planta fuera de rango se marca en «Detalles» antes de seguir', async () => {
    renderForm({ ...filled, floor: 99 });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    const floor = await screen.findByLabelText('Planta');
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(floor).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Detalles');
  });

  it('al guardar con un dato mal no envía, marca el campo y avisa', async () => {
    const images = ['https://x.test/1.jpg', 'https://x.test/2.jpg', 'https://x.test/3.jpg'];
    const { onSubmit } = renderForm({ ...filled, images, price: 900, deposit: -1 });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByLabelText('Habitaciones');
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByRole('button', { name: 'Quitar la foto 1' });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    const deposit = await screen.findByLabelText('Fianza');
    userEvent.click(screen.getByRole('button', { name: 'Crear anuncio' }));
    await waitFor(() => expect(deposit).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Revisa la fianza')).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('un número vacío da un mensaje en español, no el de zod en inglés', async () => {
    const images = ['https://x.test/1.jpg', 'https://x.test/2.jpg', 'https://x.test/3.jpg'];
    const { onSubmit } = renderForm({ ...filled, images, price: 900 });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByLabelText('Habitaciones');
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByRole('button', { name: 'Quitar la foto 1' });
    userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    const deposit = await screen.findByLabelText('Fianza');
    userEvent.clear(deposit);
    userEvent.click(screen.getByRole('button', { name: 'Crear anuncio' }));
    expect(await screen.findByText('Escribe la fianza (0 si no hay)')).toBeInTheDocument();
    expect(screen.queryByText(/Expected number/)).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('elegir una sugerencia rellena la dirección y no vuelve a buscar ni abre la lista', async () => {
    const suggestion = {
      place_id: 1,
      display_name: 'Calle de Alcalá, 42, Madrid, Comunidad de Madrid, España',
      lat: '40.4189',
      lon: '-3.6969',
      address: { city: 'Madrid', state: 'Comunidad de Madrid' },
    };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [suggestion] }));
    vi.stubGlobal('fetch', fetchMock);
    renderForm();
    userEvent.type(screen.getByLabelText('Dirección completa'), 'Alcalá 42');
    userEvent.click(await screen.findByRole('button', { name: suggestion.display_name }, { timeout: 3000 }));

    expect(screen.getByLabelText('Dirección completa')).toHaveValue(suggestion.display_name);
    expect(screen.getByLabelText('Ciudad')).toHaveValue('Madrid');
    expect(screen.getByLabelText('Latitud')).toHaveValue(40.4189);
    await new Promise((r) => setTimeout(r, 1300));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: suggestion.display_name })).toBeNull();
    expect(screen.queryByText(/Si no aparece la dirección/)).toBeNull();
  });

  it('al editar un anuncio no busca la dirección guardada', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderForm(filled);
    await new Promise((r) => setTimeout(r, 1300));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
