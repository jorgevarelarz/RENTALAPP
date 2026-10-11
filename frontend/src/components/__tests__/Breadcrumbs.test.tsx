import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Breadcrumbs from '../Breadcrumbs';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Breadcrumbs />
    </MemoryRouter>,
  );

describe('Breadcrumbs', () => {
  it('las fichas se nombran sin el ID interno', () => {
    at('/contracts/66f1a2b3c4d5e6f7a8b9c0d1');
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toHaveTextContent('Contrato');
    expect(nav).not.toHaveTextContent(/B9C0D1|#/i);
  });

  it('distingue el contrato firmado, la incidencia y el inmueble', () => {
    const { unmount } = at('/contracts/66f1a2b3c4d5e6f7a8b9c0d1/signed');
    expect(screen.getByText('Contrato firmado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contrato' })).toHaveAttribute('href', '/contracts/66f1a2b3c4d5e6f7a8b9c0d1');
    unmount();
    at('/tickets/66f1a2b3c4d5e6f7a8b9c0d1').unmount();
    at('/properties/66f1a2b3c4d5e6f7a8b9c0d1');
    expect(screen.getByText('Inmueble')).toBeInTheDocument();
  });
});
