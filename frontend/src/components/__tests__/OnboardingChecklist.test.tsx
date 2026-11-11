import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import OnboardingChecklist from '../OnboardingChecklist';

const renderList = (items: React.ComponentProps<typeof OnboardingChecklist>['items']) =>
  render(
    <MemoryRouter>
      <OnboardingChecklist items={items} />
    </MemoryRouter>,
  );

describe('Primeros pasos', () => {
  it('cuenta lo hecho y dice el estado de cada paso', () => {
    renderList([
      { label: 'Activar tus cobros', to: '/landlord/payments', done: false },
      { label: 'Publicar un inmueble', to: '/landlord', done: true },
    ]);
    expect(screen.getByText('1 de 2 hechos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Activar tus cobros\s*\(pendiente\)/ })).toHaveAttribute('href', '/landlord/payments');
    expect(screen.getByRole('link', { name: /Publicar un inmueble\s*\(hecho\)/ })).toBeInTheDocument();
  });

  it('desaparece cuando no queda nada pendiente', () => {
    const { container } = renderList([{ label: 'Publicar un inmueble', to: '/landlord', done: true }]);
    expect(container).toBeEmptyDOMElement();
  });
});
