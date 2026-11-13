import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from './Badge';
import StatusBadge from './StatusBadge';
import { ContractStatusBadge } from '../ContractStatusBadge';

describe('Badge', () => {
  it('pinta el tono con clases del sistema y sin estilos en línea', () => {
    render(<Badge tone="success" className="extra">Activo</Badge>);
    const badge = screen.getByText('Activo');
    expect(badge).toHaveClass('ra-badge', 'ra-badge-success', 'extra');
    expect(badge).not.toHaveAttribute('style');
  });

  it('usa el tono neutro por defecto', () => {
    render(<Badge>Sin estado</Badge>);
    expect(screen.getByText('Sin estado')).toHaveClass('ra-badge-neutral');
  });

  it('StatusBadge y ContractStatusBadge eligen el tono del estado', () => {
    render(
      <>
        <StatusBadge status="failed" />
        <ContractStatusBadge status="pending_signature" />
      </>,
    );
    expect(screen.getByText('Fallido')).toHaveClass('ra-badge-danger');
    expect(screen.getByText('Pendiente de firma')).toHaveClass('ra-badge-warning');
  });
});
