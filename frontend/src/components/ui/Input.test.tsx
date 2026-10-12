import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Input from './Input';
import Select from './Select';

describe('Input', () => {
  it('asocia la etiqueta al campo y usa las clases 2026 sin estilos en línea', () => {
    render(<Input label="Teléfono" className="text-right" containerClassName="flex-1" />);
    const input = screen.getByLabelText('Teléfono');
    expect(input).toHaveClass('ra-input', 'text-right');
    expect(input).not.toHaveAttribute('style');
    expect(input.closest('label')).toHaveClass('ra-field', 'flex-1');
  });

  it('sin etiqueta no pinta el texto vacío', () => {
    const { container } = render(<Input aria-label="Importe" />);
    expect(screen.getByLabelText('Importe')).toHaveClass('ra-input');
    expect(container.querySelector('.ra-field-label')).toBeNull();
  });
});

describe('Select', () => {
  it('asocia la etiqueta al desplegable y conserva las opciones', () => {
    render(
      <Select label="Duración" defaultValue="2">
        <option value="1">1 año</option>
        <option value="2">2 años</option>
      </Select>,
    );
    const select = screen.getByLabelText('Duración') as HTMLSelectElement;
    expect(select).toHaveClass('ra-input');
    expect(select).not.toHaveAttribute('style');
    expect(select.value).toBe('2');
  });
});
