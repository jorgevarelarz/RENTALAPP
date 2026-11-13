import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AssistantPage from '../Assistant';

const { queryAssistant } = vi.hoisted(() => ({ queryAssistant: vi.fn() }));
vi.mock('../../services/assistant', () => ({ queryAssistant }));

describe('Asistente Clara', () => {
  beforeEach(() => queryAssistant.mockReset());

  it('pregunta con una sugerencia y enseña la respuesta con la fuente legal', async () => {
    queryAssistant.mockResolvedValue({
      answer: 'Tu contrato termina el 31 de agosto de 2027.',
      lau: { versionDate: '2024-04-03', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003' },
    });
    render(<AssistantPage />);
    const ask = screen.getByRole('button', { name: 'Preguntar' });
    expect(ask).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '¿Cuándo termina mi contrato?' }));
    fireEvent.click(ask);

    expect(await screen.findByText('Tu contrato termina el 31 de agosto de 2027.')).toBeInTheDocument();
    expect(queryAssistant).toHaveBeenCalledWith('¿Cuándo termina mi contrato?');
    expect(screen.getByText('Has preguntado').nextSibling).toHaveTextContent('¿Cuándo termina mi contrato?');
    expect(screen.getByRole('link', { name: /Ley de Arrendamientos Urbanos \(versión 2024-04-03\)/ })).toHaveAttribute(
      'href',
      'https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003',
    );
  });

  it('no enseña códigos internos cuando falla', async () => {
    queryAssistant.mockRejectedValue({ response: { status: 500, data: { error: 'internal_server_error' } } });
    render(<AssistantPage />);
    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Debo algo?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preguntar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Clara no ha podido responder ahora.');
    expect(screen.queryByText(/internal_server_error/)).not.toBeInTheDocument();

    queryAssistant.mockResolvedValue({ answer: 'No tienes pagos pendientes.' });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('No tienes pagos pendientes.')).toBeInTheDocument());
  });
});
