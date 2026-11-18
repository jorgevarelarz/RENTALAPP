import { describe, expect, it } from 'vitest';
import { apiErrorText, NOT_VERIFIED_MESSAGE } from './apiErrors';

const res = (status: number, data: unknown) => ({ response: { status, data } });

describe('apiErrorText', () => {
  it('usa el texto propio del código antes que nada', () => {
    expect(apiErrorText(res(413, { error: 'file_too_large' }), 'x', { file_too_large: 'El archivo pasa de 10 MB.' })).toBe(
      'El archivo pasa de 10 MB.',
    );
    // validate (zod) manda el código en `message`
    expect(apiErrorText(res(400, { code: 400, message: 'validation_error' }), 'x', { validation_error: 'Revisa la pregunta.' })).toBe(
      'Revisa la pregunta.',
    );
  });

  it('enseña la frase del servidor en un 4xx, pero nunca un código en crudo', () => {
    expect(apiErrorText(res(400, { error: 'La fianza ya ha sido pagada' }), 'Reserva')).toBe('La fianza ya ha sido pagada');
    expect(apiErrorText(res(403, { error: 'forbidden' }), 'Reserva')).toBe('Reserva');
    expect(apiErrorText(res(502, { error: 'Error', message: 'Respuesta vacía del modelo' }), 'Reserva')).toBe('Reserva');
  });

  it('cubre 5xx, red, límite de peticiones e identidad sin verificar', () => {
    expect(apiErrorText(res(500, { error: 'internal_server_error', message: 'Ha ocurrido un error interno.' }), 'Reserva')).toBe('Reserva');
    expect(apiErrorText({ message: 'Network Error' }, 'Reserva')).toBe('Reserva');
    expect(apiErrorText(res(429, { error: 'Has hecho demasiadas consultas a la IA.' }), 'Reserva')).toBe(
      'Has hecho demasiadas consultas a la IA.',
    );
    expect(apiErrorText(res(403, { error: 'owner_not_verified' }), 'Reserva')).toBe(NOT_VERIFIED_MESSAGE);
  });
});
