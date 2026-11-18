import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Drawer from './Drawer';

describe('Drawer', () => {
  afterEach(() => { document.body.style.overflow = ''; });

  it('cerrado queda oculto, sin fondo y sin reaccionar a Escape', async () => {
    const onClose = vi.fn();
    const { container } = render(<Drawer open={false} onClose={onClose} label="Menú"><a href="/x">Enlace</a></Drawer>);
    const panel = screen.getByRole('dialog', { hidden: true });
    expect(panel).toHaveClass('drawer-panel', 'drawer-panel-left');
    expect(panel).not.toHaveClass('is-open');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.drawer-backdrop')).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('abierto lleva el foco al panel, cierra con Escape y con el fondo', async () => {
    const onClose = vi.fn();
    const { container } = render(<Drawer open onClose={onClose} side="right" width={300} label="Filtros">contenido</Drawer>);
    const panel = screen.getByRole('dialog', { name: 'Filtros' });
    expect(panel).toHaveClass('drawer-panel-right', 'is-open');
    expect(panel).toHaveStyle({ width: 'min(300px, 92vw)' });
    expect(panel).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(container.querySelector('.drawer-backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
