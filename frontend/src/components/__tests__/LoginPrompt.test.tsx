import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPrompt from '../LoginPrompt';

function renderPrompt(reason?: 'save' | 'apply', onClose = vi.fn(), resume = false) {
  render(
    <MemoryRouter initialEntries={['/properties/p1?from=list']}>
      <LoginPrompt open reason={reason} onClose={onClose} resume={resume} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('LoginPrompt', () => {
  it('pedir visita: explica el motivo y ofrece crear cuenta o entrar volviendo al anuncio', () => {
    renderPrompt('apply', vi.fn(), true);
    const dialog = screen.getByRole('dialog', { name: 'Pide una visita' });
    expect(dialog).toHaveTextContent(/necesitas una cuenta gratuita\. Al terminar vuelves a este anuncio para escribir tu mensaje\./);
    const back = encodeURIComponent('/properties/p1?from=list&intent=apply');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', `/register?redirect=${back}`);
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toHaveAttribute('href', `/login?redirect=${back}`);
  });

  it('guardar es el motivo por defecto y «Ahora no» cierra; sin resume solo vuelve', () => {
    const onClose = renderPrompt();
    const dialog = screen.getByRole('dialog', { name: 'Guarda este piso' });
    expect(dialog).toHaveTextContent(/Favoritos/);
    expect(dialog).not.toHaveTextContent(/ya guardado/);
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent('/properties/p1?from=list')}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('con resume, guardar vuelve con ?intent=save y lo dice', () => {
    renderPrompt('save', vi.fn(), true);
    expect(screen.getByRole('dialog', { name: 'Guarda este piso' })).toHaveTextContent(/con el piso ya guardado/);
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      `/register?redirect=${encodeURIComponent('/properties/p1?from=list&intent=save')}`,
    );
  });
});
