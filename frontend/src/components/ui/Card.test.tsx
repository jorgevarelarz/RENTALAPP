import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from './Card';

describe('Card', () => {
  it('usa la clase del sistema 2026 sin estilos en línea y conserva el className', () => {
    render(<Card className="p-5">Contenido</Card>);
    const card = screen.getByText('Contenido');
    expect(card).toHaveClass('ra-card', 'p-5');
    expect(card).not.toHaveAttribute('style');
  });

  it('sin className solo lleva ra-card', () => {
    render(<Card>Solo</Card>);
    expect(screen.getByText('Solo').className).toBe('ra-card');
  });
});
