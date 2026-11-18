import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CopyLinkButton from '../CopyLinkButton';
import { ToastProvider } from '../../context/ToastContext';

describe('CopyLinkButton', () => {
  it('copia la URL y avisa con el sistema de avisos de la app', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ToastProvider><CopyLinkButton /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Enlace copiado');
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('si el portapapeles falla, avisa con un error', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<ToastProvider><CopyLinkButton /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo copiar el enlace');
  });
});
