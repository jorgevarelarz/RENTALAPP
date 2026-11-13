import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../ToastContext';

function Pusher() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => { toast.push({ title: 'Guardado', tone: 'success' }); toast.push({ title: 'Copiado' }); }}>
        Dos
      </button>
      <button type="button" onClick={() => toast.push({ title: 'No se pudo', tone: 'error' })}>Error</button>
    </>
  );
}

describe('ToastProvider', () => {
  afterEach(() => vi.useRealTimers());

  it('dos avisos seguidos conviven y se cierran cada uno por su lado', async () => {
    render(<ToastProvider><Pusher /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Dos' }));
    expect(screen.getAllByRole('status').map(el => el.textContent)).toEqual(['Guardado', 'Copiado']);
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar aviso' })[0]);
    expect(screen.getAllByRole('status').map(el => el.textContent)).toEqual(['Copiado']);
  });

  it('un error se anuncia como alerta y dura más que un aviso normal', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Pusher /></ToastProvider>);
    act(() => { screen.getByRole('button', { name: 'Dos' }).click(); screen.getByRole('button', { name: 'Error' }).click(); });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
