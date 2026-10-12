import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPrompt from '../LoginPrompt';

function renderPrompt(reason?: 'save' | 'apply', onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/properties/p1?from=list']}>
      <LoginPrompt open reason={reason} onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('LoginPrompt', () => {
  it('pedir visita: explica el motivo y ofrece crear cuenta o entrar volviendo al anuncio', () => {
    renderPrompt('apply');
    const dialog = screen.getByRole('dialog', { name: 'Pide una visita' });
    expect(dialog).toHaveTextContent(/vuelves a este anuncio/);
    const back = encodeURIComponent('/properties/p1?from=list');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', `/register?redirect=${back}`);
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toHaveAttribute('href', `/login?redirect=${back}`);
  });

  it('guardar es el motivo por defecto y «Ahora no» cierra', () => {
    const onClose = renderPrompt();
    expect(screen.getByRole('dialog', { name: 'Guarda este piso' })).toHaveTextContent(/Favoritos/);
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(onClose).toHaveBeenCalled();
  });
});
