import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Button, { buttonClassName } from './Button';

describe('Button', () => {
  it('por defecto es type="button" y no envía el formulario', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Atrás</Button>
        <Button type="submit">Guardar</Button>
      </form>,
    );
    expect(screen.getByRole('button', { name: 'Atrás' })).toHaveAttribute('type', 'button');
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('usa las clases 2026, sin estilos en línea, y conserva el className de quien llama', () => {
    render(<Button variant="secondary" size="sm" className="w-full">Editar</Button>);
    const btn = screen.getByRole('button', { name: 'Editar' });
    expect(btn).toHaveClass('ra-btn', 'ra-btn-secondary', 'ra-btn-sm', 'w-full');
    expect(btn).not.toHaveAttribute('style');
  });

  it('buttonClassName: outline equivale a secondary y md no añade clase de tamaño', () => {
    expect(buttonClassName('outline')).toBe('ra-btn ra-btn-secondary');
    expect(buttonClassName('primary', 'md', 'flex-1')).toBe('ra-btn ra-btn-primary flex-1');
    expect(buttonClassName('danger', 'lg')).toBe('ra-btn ra-btn-danger ra-btn-lg');
  });
});
