import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  afterEach(() => { document.body.style.overflow = ''; });

  it('cerrado no bloquea el scroll ni reacciona a Escape', async () => {
    const onClose = vi.fn();
    render(<Modal open={false} onClose={onClose} title="Aviso">contenido</Modal>);
    expect(document.body.style.overflow).toBe('');
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('abierto bloquea el scroll, cierra con Escape y no roba el foco al volver a pintarse', async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      const [text, setText] = useState('');
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Formulario">
          <button type="button">Primero</button>
          <input aria-label="Nombre" value={text} onChange={(e) => setText(e.target.value)} />
        </Modal>
      );
    }
    render(<Host />);
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('se nombra por el título, cierra con «Cerrar» y con el fondo, no al pulsar dentro, y pasa className al panel', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Firma electrónica" className="max-w-6xl"><p>dentro</p><a href="/x">Firmar</a></Modal>);
    // El foco va al contenido, no a «Cerrar»
    await vi.waitFor(() => expect(screen.getByRole('link', { name: 'Firmar' })).toHaveFocus());
    const dialog = screen.getByRole('dialog', { name: 'Firma electrónica' });
    expect(dialog).toHaveClass('ra-modal-panel', 'max-w-6xl');
    expect(screen.getByRole('heading', { level: 2, name: 'Firma electrónica' })).toBeInTheDocument();

    await userEvent.click(screen.getByText('dentro'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
