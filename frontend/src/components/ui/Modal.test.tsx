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
});
