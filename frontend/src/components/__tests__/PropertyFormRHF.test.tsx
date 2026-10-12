import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyFormRHF from '../PropertyFormRHF';

// setupTests sustituye zodResolver por uno que nunca da errores; aquí hace falta el real
vi.unmock('@hookform/resolvers/zod');

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
});
