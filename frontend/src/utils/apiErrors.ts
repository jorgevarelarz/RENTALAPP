/** Textos de error de la API para el usuario. Sin dependencias para poder usarlo en utilidades puras. */

// requireVerified (backend) rechaza con estos códigos a quien aún no tiene la identidad verificada.
// No es un fallo que reintentar ni que reportar, así que se explica sin referencia.
const NOT_VERIFIED_CODES = new Set(['owner_not_verified', 'user_not_verified']);
export const NOT_VERIFIED_MESSAGE = 'Necesitas verificar tu identidad para usar esta sección.';

export function isNotVerifiedError(err: any) {
  return err?.response?.status === 403 && NOT_VERIFIED_CODES.has(err?.response?.data?.error);
}

// Una frase del servidor («La fianza ya ha sido pagada») se puede enseñar; un código
// («forbidden», «validation_error») o el nombre de una excepción («Error») no.
const isSentence = (value: unknown): value is string => typeof value === 'string' && /\S\s+\S/.test(value.trim());

/**
 * Mensaje para mostrar a partir de un error de axios: el texto propio del código si está en `texts`,
 * la frase que mande el servidor en un 4xx o, si no, `fallback`. Nunca el código en crudo, ni los
 * mensajes de un 5xx o de red («Network Error»).
 */
export function apiErrorText(err: any, fallback: string, texts: Record<string, string> = {}) {
  if (isNotVerifiedError(err)) return NOT_VERIFIED_MESSAGE;
  const status = err?.response?.status;
  const data = err?.response?.data;
  // El código va en `error`, en `code` o, en las validaciones de zod (middleware/validate), en `message`.
  const code = [data?.error, data?.code, data?.message].find((v) => typeof v === 'string' && v && !isSentence(v)) || '';
  if (code && Object.prototype.hasOwnProperty.call(texts, code)) return texts[code];
  if (status === 429) return isSentence(data?.error) ? data.error : 'Has hecho demasiadas peticiones. Espera unos minutos.';
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (isSentence(data?.error)) return data.error;
    if (isSentence(data?.message)) return data.message;
  }
  return fallback;
}
